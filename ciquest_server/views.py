import datetime
import hashlib
import json
import math
import mimetypes
import os
import secrets
import urllib.parse
import urllib.request
from urllib.error import HTTPError, URLError

import jwt

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import logout as django_logout
from django.contrib.auth.hashers import check_password, make_password
from django.core.exceptions import SuspiciousFileOperation
from django.core.mail import get_connection, send_mail
from django.db.models import Q
from django.http import FileResponse, Http404, JsonResponse
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils import timezone
from django.utils._os import safe_join
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from ciquest_model.models import (
    AdminAccount,
    Badge,
    AdminInquiry,
    Challenge,
    Coupon,
    Rank,
    Notice,
    Store,
    StoreOwner,
    StoreTag,
    StoreStamp,
    StoreStampSetting,
    StoreStampHistory,
    StoreStampReward,
    Tag,
    User,
    UserChallenge,
    UserCoupon,
    UserCouponUsageHistory,
    UserBadge,
    StoreCouponUsageHistory,
    UserRefreshToken,
)
from ciquest_model.markdown_utils import render_markdown
from ciquest_server.forms import AdminSignupForm, OwnerProfileForm, OwnerSignupForm


def landing(request):
    return render(request, "common/landing.html")


def owner_entry(request):
    owner_id = request.session.get("owner_id")
    if owner_id:
        return redirect("owner_dashboard")
    return redirect("login")


def unified_login(request):
    error = None
    if request.method == "POST":
        identifier = (request.POST.get("identifier") or "").strip()
        password = request.POST.get("password") or ""

        owner = StoreOwner.objects.filter(email__iexact=identifier).first()
        if owner and _verify_password(password, owner.password, owner):
            if not owner.is_verified:
                error = "Email verification is not completed. Please click the link in the email."
            elif not owner.onboarding_completed:
                request.session.flush()
                request.session["owner_id"] = owner.owner_id
                request.session["admin_authenticated"] = False
                messages.info(request, "Please complete your account setup.")
                return redirect("owner_onboarding")
            elif owner.approved:
                request.session.flush()
                request.session["owner_id"] = owner.owner_id
                request.session["admin_authenticated"] = False
                return redirect("owner_dashboard")
            else:
                error = "Your store is awaiting approval. Please wait for the review."
        else:
            admin = AdminAccount.objects.filter(email__iexact=identifier, is_deleted=False).first()
            if admin and _verify_password(password, admin.password, admin):
                if admin.approval_status != "approved" or not admin.is_active:
                    error = "This account is not approved or is inactive. Please contact another admin."
                else:
                    request.session.flush()
                    request.session["admin_authenticated"] = True
                    request.session["admin_id"] = admin.admin_id
                    # 管理ログイン通知メール（EMAIL_HOST が未設定なら送信しない）
                    if getattr(settings, "EMAIL_HOST", ""):
                        try:
                            ip = request.META.get("REMOTE_ADDR") or "unknown"
                            now = timezone.now().strftime("%Y-%m-%d %H:%M:%S %Z")
                            subject = "【Ciquest】運営ログイン通知"
                            body = (
                                f"{admin.name} 様\n\n"
                                "以下の内容で運営ダッシュボードへのログインが行われました。\n"
                                f"日時: {now}\n"
                                f"IP: {ip}\n\n"
                                "心当たりがない場合はパスワードを変更し、他の運営に連絡してください。"
                            )
                            from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None) or getattr(
                                settings, "EMAIL_HOST_USER", None
                            ) or "no-reply@ciquest.local"
                            try:
                                connection = get_connection(timeout=5)
                            except Exception:
                                connection = None
                            send_mail(subject, body, from_email, [admin.email], fail_silently=True, connection=connection)
                        except Exception:
                            pass
                    return redirect("admin_dashboard")
            else:
                error = "Email address or password is incorrect."

    return render(request, "common/login.html", {"error": error})


def unified_logout(request):
    django_logout(request)
    request.session.flush()
    return redirect("login")


def _google_oauth_configured():
    return bool(settings.GOOGLE_OAUTH_CLIENT_ID and settings.GOOGLE_OAUTH_CLIENT_SECRET)


def _google_redirect_uri(request):
    return settings.GOOGLE_OAUTH_REDIRECT_URI or request.build_absolute_uri(reverse("google_owner_callback"))


def _google_mobile_client_ids():
    mobile_ids = list(getattr(settings, "GOOGLE_OAUTH_MOBILE_CLIENT_IDS", []) or [])
    if settings.GOOGLE_OAUTH_CLIENT_ID:
        mobile_ids.append(settings.GOOGLE_OAUTH_CLIENT_ID)
    return [value for value in mobile_ids if value]


def _fetch_google_tokeninfo(id_token=None, access_token=None):
    if id_token:
        url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + urllib.parse.quote(
            id_token
        )
    elif access_token:
        url = "https://oauth2.googleapis.com/tokeninfo?access_token=" + urllib.parse.quote(
            access_token
        )
    else:
        return None
    try:
        with urllib.request.urlopen(url, timeout=8) as response:
            return json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, json.JSONDecodeError):
        return None


def google_owner_login(request):
    if not _google_oauth_configured():
        messages.error(request, "Google login is not configured.")
        return redirect("login")

    state = secrets.token_urlsafe(24)
    request.session["google_oauth_state"] = state
    params = {
        "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
        "redirect_uri": _google_redirect_uri(request),
        "response_type": "code",
        "scope": settings.GOOGLE_OAUTH_SCOPES,
        "state": state,
        "prompt": "select_account",
        "access_type": "online",
        "include_granted_scopes": "true",
    }
    auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
    return redirect(auth_url)


def google_owner_callback(request):
    if not _google_oauth_configured():
        messages.error(request, "Google login is not configured.")
        return redirect("login")

    error = request.GET.get("error")
    if error:
        messages.error(request, f"Google login failed: {error}")
        return redirect("login")

    state = request.GET.get("state")
    stored_state = request.session.get("google_oauth_state")
    if not state or not stored_state or state != stored_state:
        messages.error(request, "Invalid OAuth state. Please try again.")
        return redirect("login")
    request.session.pop("google_oauth_state", None)

    code = request.GET.get("code")
    if not code:
        messages.error(request, "Missing OAuth code. Please try again.")
        return redirect("login")

    token_payload = {
        "code": code,
        "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
        "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
        "redirect_uri": _google_redirect_uri(request),
        "grant_type": "authorization_code",
    }
    token_req = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=urllib.parse.urlencode(token_payload).encode("utf-8"),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(token_req, timeout=8) as response:
            token_data = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, json.JSONDecodeError):
        messages.error(request, "Failed to exchange OAuth token.")
        return redirect("login")

    access_token = token_data.get("access_token")
    if not access_token:
        messages.error(request, "Missing access token from Google.")
        return redirect("login")

    userinfo_req = urllib.request.Request(
        "https://openidconnect.googleapis.com/v1/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(userinfo_req, timeout=8) as response:
            userinfo = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, json.JSONDecodeError):
        messages.error(request, "Failed to fetch Google profile.")
        return redirect("login")

    email = (userinfo.get("email") or "").strip().lower()
    email_verified = userinfo.get("email_verified", False)
    name = (userinfo.get("name") or userinfo.get("given_name") or "").strip()

    if not email or not email_verified:
        messages.error(request, "Google account email is not verified.")
        return redirect("login")

    owner = StoreOwner.objects.filter(email__iexact=email).first()
    if not owner:
        owner = StoreOwner(
            email=email,
            name=name,
            password=secrets.token_urlsafe(18),
            is_verified=True,
        )
        owner.save()
    else:
        update_fields = []
        if not owner.is_verified:
            owner.is_verified = True
            update_fields.append("is_verified")
        if name and not owner.name:
            owner.name = name
            update_fields.append("name")
        if update_fields:
            owner.save(update_fields=update_fields)

    if not owner.onboarding_completed:
        request.session.flush()
        request.session["owner_id"] = owner.owner_id
        request.session["admin_authenticated"] = False
        messages.info(request, "Please complete your account setup.")
        return redirect("owner_onboarding")

    if owner.approved:
        request.session.flush()
        request.session["owner_id"] = owner.owner_id
        request.session["admin_authenticated"] = False
        return redirect("owner_dashboard")

    messages.error(request, "Your store is awaiting approval. Please wait for the review.")
    return redirect("login")


@csrf_exempt
@require_http_methods(["POST"])
def api_google_login(request):
    data, error = _get_request_data(request)
    if error:
        return error
    id_token = (data.get("id_token") or "").strip() if data else ""
    access_token = (data.get("access_token") or "").strip() if data else ""
    if not id_token and not access_token:
        return _json_error("id_token or access_token is required.", status=400)

    tokeninfo = _fetch_google_tokeninfo(id_token=id_token or None, access_token=access_token or None)
    if not tokeninfo:
        return _json_error("Failed to verify Google token.", status=401)

    email = (tokeninfo.get("email") or "").strip().lower()
    email_verified = tokeninfo.get("email_verified", False)
    aud = tokeninfo.get("aud")
    if isinstance(email_verified, str):
        email_verified = email_verified.lower() == "true"

    if not email or not email_verified:
        return _json_error("Google account email is not verified.", status=401)

    allowed_aud = _google_mobile_client_ids()
    if allowed_aud and aud not in allowed_aud:
        return _json_error("Invalid Google client.", status=401)

    user = User.objects.select_related("rank").filter(email__iexact=email).first()
    if not user:
        base_name = (
            tokeninfo.get("name")
            or tokeninfo.get("given_name")
            or email.split("@")[0]
        )
        base_name = (base_name or email.split("@")[0]).strip()
        username = base_name or email.split("@")[0]
        candidate = username
        suffix = 1
        while User.objects.filter(username=candidate).exists():
            suffix += 1
            candidate = f"{username}{suffix}"
        user = User.objects.create(
            username=candidate,
            email=email,
            password=make_password(secrets.token_urlsafe(18)),
        )
    _ensure_user_rank(user)
    access = _create_access_token(user)
    refresh = _create_refresh_token(user)
    return JsonResponse({"user": _serialize_user(user), "access": access, "refresh": refresh})


def _haversine_km(lat1, lon1, lat2, lon2):
    """Calculate distance between two points on Earth in kilometers."""
    r = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def _verify_password(raw_password, stored_password, user_obj):
    if not stored_password:
        return False
    if check_password(raw_password, stored_password):
        return True
    if stored_password == raw_password:
        user_obj.password = make_password(raw_password)
        user_obj.save(update_fields=["password"])
        return True
    return False


def _json_error(message, status=400):
    return JsonResponse({"detail": message}, status=status)


def _file_response(file_path):
    content_type, _ = mimetypes.guess_type(file_path)
    if not content_type:
        ext = os.path.splitext(file_path)[1].lower()
        if ext in {".js", ".mjs"}:
            content_type = "application/javascript"
        elif ext == ".css":
            content_type = "text/css"
        elif ext == ".json":
            content_type = "application/json"
        elif ext == ".svg":
            content_type = "image/svg+xml"
        else:
            content_type = "application/octet-stream"
    return FileResponse(open(file_path, "rb"), content_type=content_type)


@require_http_methods(["GET"])
def phone_web(request, path=""):
    base_dir = str(getattr(settings, "PHONE_WEB_DIR", ""))
    if not base_dir:
        return redirect("landing")

    request_path = request.path or ""
    if path:
        candidate_rel_paths = [path]
        if request_path.startswith("/_expo/") and not path.startswith("_expo/"):
            candidate_rel_paths.insert(0, os.path.join("_expo", path))
        if request_path.startswith("/assets/") and not path.startswith("assets/"):
            candidate_rel_paths.insert(0, os.path.join("assets", path))

        for candidate_rel in candidate_rel_paths:
            try:
                candidate = safe_join(base_dir, candidate_rel)
            except SuspiciousFileOperation:
                continue
            if os.path.isfile(candidate):
                return _file_response(candidate)

        if request_path.startswith("/phone"):
            index_path = os.path.join(base_dir, "index.html")
            if os.path.isfile(index_path):
                return _file_response(index_path)

        raise Http404("Asset not found.")

    index_path = os.path.join(base_dir, "index.html")
    if os.path.isfile(index_path):
        return _file_response(index_path)
    return redirect("landing")


def _get_request_data(request):
    if request.content_type and "application/json" in request.content_type:
        try:
            raw_body = request.body.decode("utf-8") if request.body else ""
            data = json.loads(raw_body or "{}")
        except (json.JSONDecodeError, UnicodeDecodeError):
            return None, _json_error("Invalid JSON.", status=400)
        return data, None
    return request.POST, None


def _serialize_user(user):
    return {
        "id": user.user_id,
        "username": user.username,
        "email": user.email,
        "rank_id": user.rank_id,
        "rank": user.rank.name if user.rank else None,
        "rank_multiplier": _rank_multiplier(user.rank),
        "points": user.points,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


RANK_DEFINITIONS = [
    {"name": "ブロンズ", "threshold": 0, "multiplier": 1.0},
    {"name": "シルバー", "threshold": 25, "multiplier": 1.1},
    {"name": "ゴールド", "threshold": 50, "multiplier": 1.2},
    {"name": "レジェンド", "threshold": 100, "multiplier": 1.3},
    {"name": "エリート", "threshold": 200, "multiplier": 1.4},
]
RANK_ORDER = [definition["name"] for definition in RANK_DEFINITIONS]


def _rank_period_start(now=None):
    current = timezone.localtime(now or timezone.now())
    start_month = current.month if current.month % 2 == 1 else current.month - 1
    start_year = current.year
    start_date = datetime.datetime(start_year, start_month, 1)
    return timezone.make_aware(start_date, timezone.get_current_timezone())


def _ensure_rank_catalog():
    ranks = {}
    for definition in RANK_DEFINITIONS:
        rank, created = Rank.objects.get_or_create(
            name=definition["name"],
            defaults={"required_points": definition["threshold"]},
        )
        if not created and rank.required_points != definition["threshold"]:
            rank.required_points = definition["threshold"]
            rank.save(update_fields=["required_points"])
        ranks[definition["name"]] = rank
    return ranks


def _rank_index(rank):
    if not rank:
        return 0
    try:
        return RANK_ORDER.index(rank.name)
    except ValueError:
        return 0


def _rank_multiplier(rank):
    if not rank:
        return 1.0
    for definition in RANK_DEFINITIONS:
        if definition["name"] == rank.name:
            return definition["multiplier"]
    return 1.0


def _rank_from_clears(clears, ranks):
    for definition in reversed(RANK_DEFINITIONS):
        if clears >= definition["threshold"]:
            return ranks[definition["name"]]
    return ranks[RANK_ORDER[0]]


def _ensure_user_rank(user):
    ranks = _ensure_rank_catalog()
    fields_to_update = []

    if not user.rank_id:
        user.rank = ranks[RANK_ORDER[0]]
        fields_to_update.append("rank")
    current_rank = user.rank or ranks[RANK_ORDER[0]]

    period_start = _rank_period_start()
    if user.last_rank_reset_at is None or user.last_rank_reset_at < period_start:
        new_index = max(_rank_index(current_rank) - 1, 0)
        new_rank = ranks[RANK_ORDER[new_index]]
        if current_rank.rank_id != new_rank.rank_id:
            user.rank = new_rank
            fields_to_update.append("rank")
            current_rank = new_rank
        user.last_rank_reset_at = period_start
        fields_to_update.append("last_rank_reset_at")

    clears = UserChallenge.objects.filter(
        user=user,
        status="cleared",
        cleared_at__gte=period_start,
    ).count()
    target_rank = _rank_from_clears(clears, ranks)
    if _rank_index(target_rank) > _rank_index(current_rank):
        user.rank = target_rank
        fields_to_update.append("rank")
        current_rank = target_rank

    if fields_to_update:
        user.save(update_fields=sorted(set(fields_to_update)))
    return current_rank, clears


BADGE_DEFINITIONS = [
    {"code": "quest_1", "name": "はじめの一歩", "description": "クエストを1回クリア", "category": "quest", "hidden": False},
    {"code": "quest_10", "name": "冒険者", "description": "クエストを10回クリア", "category": "quest", "hidden": False},
    {"code": "quest_50", "name": "熟練者", "description": "クエストを50回クリア", "category": "quest", "hidden": False},
    {"code": "quest_200", "name": "伝説", "description": "クエストを200回クリア", "category": "quest", "hidden": False},
    {"code": "stamp_5", "name": "コレクター", "description": "スタンプを5回獲得", "category": "stamp", "hidden": False},
    {"code": "stamp_20", "name": "マニア", "description": "スタンプを20回獲得", "category": "stamp", "hidden": False},
    {"code": "stamp_100", "name": "マスター", "description": "スタンプを100回獲得", "category": "stamp", "hidden": False},
    {"code": "store_3", "name": "探索者", "description": "3店舗でクエストをクリア", "category": "store", "hidden": False},
    {"code": "store_10", "name": "放浪者", "description": "10店舗でクエストをクリア", "category": "store", "hidden": False},
    {"code": "store_30", "name": "世界見聞", "description": "30店舗でクエストをクリア", "category": "store", "hidden": False},
    {"code": "night_owl", "name": "夜更かし冒険者", "description": "深夜にクエストをクリア", "category": "hidden", "hidden": True},
    {"code": "streak_7", "name": "連続挑戦者", "description": "7日連続でクエストをクリア", "category": "hidden", "hidden": True},
    {"code": "stamp_artisan", "name": "スタンプ職人", "description": "同じ店舗でスタンプを10回獲得", "category": "hidden", "hidden": True},
]


def _ensure_badge_catalog():
    badges = {}
    for definition in BADGE_DEFINITIONS:
        badge, created = Badge.objects.get_or_create(
            code=definition["code"],
            defaults={
                "name": definition["name"],
                "description": definition["description"],
                "category": definition["category"],
                "is_hidden": definition["hidden"],
            },
        )
        if not created:
            updates = []
            if badge.name != definition["name"]:
                badge.name = definition["name"]
                updates.append("name")
            if badge.description != definition["description"]:
                badge.description = definition["description"]
                updates.append("description")
            if badge.category != definition["category"]:
                badge.category = definition["category"]
                updates.append("category")
            if badge.is_hidden != definition["hidden"]:
                badge.is_hidden = definition["hidden"]
                updates.append("is_hidden")
            if updates:
                badge.save(update_fields=updates)
        badges[definition["code"]] = badge
    return badges


def _serialize_badge(badge, awarded_at=None):
    return {
        "id": badge.badge_id,
        "code": badge.code,
        "name": badge.name,
        "description": badge.description or "",
        "category": badge.category,
        "awarded_at": awarded_at.isoformat() if awarded_at else None,
    }


def _grant_badge(user, badge):
    user_badge, created = UserBadge.objects.get_or_create(user=user, badge=badge)
    if not created:
        return None
    return _serialize_badge(badge, awarded_at=user_badge.awarded_at)


def _has_streak(user, days):
    cleared_dates = set(
        UserChallenge.objects.filter(user=user, status="cleared")
        .values_list("cleared_at__date", flat=True)
        .distinct()
    )
    if not cleared_dates:
        return False
    current = timezone.localdate()
    for _ in range(days):
        if current not in cleared_dates:
            return False
        current -= datetime.timedelta(days=1)
    return True


def _award_badges_for_user(user, cleared_at=None, store_id=None):
    badges = _ensure_badge_catalog()
    new_badges = []

    def maybe_award(code, condition):
        if not condition:
            return
        payload = _grant_badge(user, badges[code])
        if payload:
            new_badges.append(payload)

    total_clears = UserChallenge.objects.filter(user=user, status="cleared").count()
    maybe_award("quest_1", total_clears >= 1)
    maybe_award("quest_10", total_clears >= 10)
    maybe_award("quest_50", total_clears >= 50)
    maybe_award("quest_200", total_clears >= 200)

    total_stamps = StoreStampHistory.objects.filter(user=user).count()
    maybe_award("stamp_5", total_stamps >= 5)
    maybe_award("stamp_20", total_stamps >= 20)
    maybe_award("stamp_100", total_stamps >= 100)

    unique_stores = (
        UserChallenge.objects.filter(user=user, status="cleared")
        .values("challenge__store_id")
        .distinct()
        .count()
    )
    maybe_award("store_3", unique_stores >= 3)
    maybe_award("store_10", unique_stores >= 10)
    maybe_award("store_30", unique_stores >= 30)

    if cleared_at:
        local_time = timezone.localtime(cleared_at)
        maybe_award("night_owl", 0 <= local_time.hour < 5)
        maybe_award("streak_7", _has_streak(user, 7))

    if store_id:
        user_stamp = StoreStamp.objects.filter(user=user, store_id=store_id).first()
        if user_stamp and user_stamp.stamps_count >= 10:
            maybe_award("stamp_artisan", True)

    return new_badges


def _hash_token(raw_token):
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _extract_bearer_token(request):
    auth_header = request.headers.get("Authorization") or request.META.get("HTTP_AUTHORIZATION")
    if not auth_header:
        return None
    parts = auth_header.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None


def _jwt_secret():
    return getattr(settings, "JWT_SECRET_KEY", settings.SECRET_KEY)


def _jwt_encode(payload):
    return jwt.encode(payload, _jwt_secret(), algorithm=getattr(settings, "JWT_ALGORITHM", "HS256"))


def _jwt_decode(raw_token):
    return jwt.decode(
        raw_token,
        _jwt_secret(),
        algorithms=[getattr(settings, "JWT_ALGORITHM", "HS256")],
    )


def _jwt_timestamps(lifetime_seconds):
    now = timezone.now()
    exp = now + datetime.timedelta(seconds=lifetime_seconds)
    return now, exp


def _create_access_token(user):
    now, exp = _jwt_timestamps(getattr(settings, "JWT_ACCESS_LIFETIME_SECONDS", 900))
    payload = {
        "sub": str(user.user_id),
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    return _jwt_encode(payload)


def _create_refresh_token(user):
    now, exp = _jwt_timestamps(
        getattr(settings, "JWT_REFRESH_LIFETIME_SECONDS", 60 * 60 * 24 * 14)
    )
    jti = secrets.token_hex(16)
    payload = {
        "sub": str(user.user_id),
        "type": "refresh",
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    raw_token = _jwt_encode(payload)
    UserRefreshToken.objects.filter(user=user, revoked_at__isnull=True).update(revoked_at=now)
    UserRefreshToken.objects.create(
        user=user,
        token_hash=_hash_token(raw_token),
        expires_at=exp,
    )
    return raw_token


def _get_user_from_access_token(request):
    raw_token = _extract_bearer_token(request)
    if not raw_token:
        return None, _json_error("Authorization token is required.", status=401)
    try:
        payload = _jwt_decode(raw_token)
    except jwt.ExpiredSignatureError:
        return None, _json_error("Token has expired.", status=401)
    except jwt.InvalidTokenError:
        return None, _json_error("Invalid token.", status=401)
    if payload.get("type") != "access":
        return None, _json_error("Invalid token type.", status=401)
    user_id = payload.get("sub")
    if not user_id:
        return None, _json_error("Invalid token.", status=401)
    user = User.objects.select_related("rank").filter(user_id=user_id).first()
    if not user:
        return None, _json_error("User not found.", status=401)
    return user, None


def _require_phone_api_key(request):
    expected_key = getattr(settings, "PHONE_API_KEY", "")
    if not expected_key:
        return None
    provided_key = request.headers.get("phone-API-key") or request.META.get("HTTP_PHONE_API_KEY")
    if not provided_key or not secrets.compare_digest(provided_key, expected_key):
        return JsonResponse({"detail": "認証に失敗しました。"}, status=401)
    return None


@csrf_exempt
@require_http_methods(["POST"])
def api_user_create(request):
    data, error = _get_request_data(request)
    if error:
        return error
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not username or not email or not password:
        return _json_error("username, email, password are required.", status=400)
    if User.objects.filter(email__iexact=email).exists():
        return _json_error("Email already exists.", status=400)

    user = User.objects.create(username=username, email=email, password=password)
    _ensure_user_rank(user)
    return JsonResponse(_serialize_user(user), status=201)


@csrf_exempt
@require_http_methods(["POST"])
def api_login(request):
    data, error = _get_request_data(request)
    if error:
        return error
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return _json_error("email and password are required.", status=400)

    user = User.objects.select_related("rank").filter(email__iexact=email).first()
    if not user or not _verify_password(password, user.password, user):
        return _json_error("Email address or password is incorrect.", status=401)

    _ensure_user_rank(user)
    access = _create_access_token(user)
    refresh = _create_refresh_token(user)
    return JsonResponse({"user": _serialize_user(user), "access": access, "refresh": refresh})


@csrf_exempt
@require_http_methods(["POST"])
def api_token_refresh(request):
    data, error = _get_request_data(request)
    if error:
        return error
    refresh = data.get("refresh") if data else None
    if not refresh:
        return _json_error("refresh is required.", status=400)
    try:
        payload = _jwt_decode(refresh)
    except jwt.ExpiredSignatureError:
        return _json_error("Token has expired.", status=401)
    except jwt.InvalidTokenError:
        return _json_error("Invalid token.", status=401)
    if payload.get("type") != "refresh":
        return _json_error("Invalid token type.", status=401)
    token_hash = _hash_token(refresh)
    token_obj = (
        UserRefreshToken.objects.select_related("user", "user__rank")
        .filter(token_hash=token_hash, revoked_at__isnull=True)
        .first()
    )
    if not token_obj:
        return _json_error("Invalid token.", status=401)
    if token_obj.expires_at and token_obj.expires_at <= timezone.now():
        return _json_error("Token has expired.", status=401)
    access = _create_access_token(token_obj.user)
    return JsonResponse({"access": access})


@csrf_exempt
@require_http_methods(["POST"])
def api_logout(request):
    data, error = _get_request_data(request)
    if error:
        return error
    refresh = data.get("refresh") if data else None
    if not refresh:
        return _json_error("refresh is required.", status=400)
    token_hash = _hash_token(refresh)
    token_obj = UserRefreshToken.objects.filter(token_hash=token_hash, revoked_at__isnull=True).first()
    if not token_obj:
        return _json_error("Invalid token.", status=401)
    token_obj.revoked_at = timezone.now()
    token_obj.save(update_fields=["revoked_at"])
    return JsonResponse({"detail": "Logged out."})


@require_http_methods(["GET"])
def api_me(request):
    user, error = _get_user_from_access_token(request)
    if error:
        return error
    _ensure_user_rank(user)
    return JsonResponse(_serialize_user(user))


@csrf_exempt
@require_http_methods(["POST"])
def api_user_challenge_clear(request):
    user, error = _get_user_from_access_token(request)
    if error:
        return error
    data, error = _get_request_data(request)
    if error:
        return error

    challenge_id = data.get("challenge_id") if data else None
    qr_code = (data.get("qr_code") or "").strip() if data else ""
    lat = data.get("lat") if data else None
    lon = data.get("lon") if data else None
    if not challenge_id or not qr_code or lat is None or lon is None:
        return _json_error("challenge_id, qr_code, lat, and lon are required.", status=400)
    try:
        challenge_id = int(challenge_id)
    except (TypeError, ValueError):
        return _json_error("challenge_id must be an integer.", status=400)
    try:
        lat = float(lat)
        lon = float(lon)
    except (TypeError, ValueError):
        return _json_error("lat and lon must be numbers.", status=400)

    challenge = Challenge.objects.filter(pk=challenge_id).first()
    if not challenge:
        return _json_error("Challenge not found.", status=404)
    if not challenge.qr_code:
        return _json_error("Challenge qr_code is not set.", status=400)
    if qr_code != challenge.qr_code:
        return _json_error("qr_code does not match.", status=400)
    if challenge.store_id is None or challenge.store is None:
        return _json_error("Challenge store is not set.", status=400)
    if challenge.store.latitude is None or challenge.store.longitude is None:
        return _json_error("Store location is not set.", status=400)
    distance_m = _haversine_km(
        lat,
        lon,
        float(challenge.store.latitude),
        float(challenge.store.longitude),
    ) * 1000
    if distance_m > 50:
        return _json_error("User is not within 50m of the store.", status=400)

    today = timezone.localdate()
    already_cleared_today = UserChallenge.objects.filter(
        user=user,
        challenge=challenge,
        status="cleared",
        cleared_at__date=today,
    ).exists()
    if already_cleared_today:
        return _json_error("Already cleared this challenge today.", status=400)

    daily_cleared_count = UserChallenge.objects.filter(
        user=user,
        status="cleared",
        cleared_at__date=today,
    ).count()
    if daily_cleared_count >= 5:
        return _json_error("Daily clear limit reached.", status=400)

    now = timezone.now()
    user_challenge, created = UserChallenge.objects.get_or_create(
        user=user,
        challenge=challenge,
        defaults={
            "status": "cleared",
            "cleared_at": now,
        },
    )
    if not created:
        user_challenge.status = "cleared"
        user_challenge.cleared_at = now
        user_challenge.save(update_fields=["status", "cleared_at"])

    previous_rank = user.rank
    previous_rank_index = _rank_index(previous_rank)
    _ensure_user_rank(user)
    current_rank = user.rank
    current_rank_index = _rank_index(current_rank)
    rank_multiplier = _rank_multiplier(current_rank)
    rank_up = current_rank_index > previous_rank_index

    reward_points_awarded = 0
    reward_coupon = None
    reward_granted = False
    if challenge.reward_type == "points":
        if challenge.reward_points:
            reward_points_awarded = int(round(challenge.reward_points * rank_multiplier))
            user.points = (user.points or 0) + reward_points_awarded
            user.save(update_fields=["points"])
            reward_granted = True
    elif challenge.reward_type == "coupon" and challenge.reward_coupon_id:
        reward_coupon = challenge.reward_coupon
        user_coupon, created_coupon = UserCoupon.objects.get_or_create(
            user=user,
            coupon=reward_coupon,
            defaults={"is_used": False, "used_at": None},
        )
        reward_granted = created_coupon
    elif challenge.reward_type == "service":
        reward_granted = True

    reward_detail = challenge.reward_detail or ""
    if not reward_detail and reward_coupon:
        reward_detail = reward_coupon.title

    new_badges = _award_badges_for_user(
        user,
        cleared_at=user_challenge.cleared_at,
        store_id=challenge.store_id,
    )

    response = {
        "user_challenge_id": user_challenge.user_challenge_id,
        "challenge_id": challenge.challenge_id,
        "status": user_challenge.status,
        "cleared_at": user_challenge.cleared_at.isoformat() if user_challenge.cleared_at else None,
        "reward_type": challenge.reward_type,
        "reward_points": reward_points_awarded,
        "reward_detail": reward_detail,
        "reward_coupon_id": reward_coupon.coupon_id if reward_coupon else None,
        "reward_coupon_title": reward_coupon.title if reward_coupon else "",
        "reward_granted": reward_granted,
        "user_points": user.points,
        "rank": current_rank.name if current_rank else None,
        "rank_id": current_rank.rank_id if current_rank else None,
        "rank_multiplier": rank_multiplier,
        "previous_rank": previous_rank.name if previous_rank else None,
        "previous_rank_id": previous_rank.rank_id if previous_rank else None,
        "rank_up": rank_up,
        "new_badges": new_badges,
    }
    return JsonResponse(response, status=201 if created else 200)


@csrf_exempt
@require_http_methods(["POST"])
def api_user_coupon_use(request):
    user, error = _get_user_from_access_token(request)
    if error:
        return error
    data, error = _get_request_data(request)
    if error:
        return error

    coupon_id = data.get("coupon_id") if data else None
    store_qr = (data.get("store_qr") or "").strip() if data else ""
    if not coupon_id or not store_qr:
        return _json_error("coupon_id and store_qr are required.", status=400)
    try:
        coupon_id = int(coupon_id)
    except (TypeError, ValueError):
        return _json_error("coupon_id must be an integer.", status=400)

    coupon = Coupon.objects.select_related("store").filter(pk=coupon_id).first()
    if not coupon:
        return _json_error("Coupon not found.", status=404)
    store = Store.objects.filter(qr_code=store_qr).first()
    if not store:
        return _json_error("Store not found.", status=404)
    if coupon.type == "store_specific":
        if not coupon.store_id or coupon.store_id != store.store_id:
            return _json_error("Coupon is not valid for this store.", status=400)

    user_coupon = UserCoupon.objects.filter(user=user, coupon=coupon).first()
    if not user_coupon:
        return _json_error("Coupon is not owned by user.", status=404)
    if user_coupon.is_used:
        return _json_error("Coupon already used.", status=400)

    now = timezone.now()
    user_coupon.is_used = True
    user_coupon.used_at = now
    user_coupon.save(update_fields=["is_used", "used_at"])

    UserCouponUsageHistory.objects.create(
        user=user,
        coupon=coupon,
        store=store,
        coupon_type=coupon.type,
        used_at=now,
    )
    StoreCouponUsageHistory.objects.create(
        store=store,
        user=user,
        coupon=coupon,
        coupon_type=coupon.type,
        used_at=now,
    )

    response = {
        "user_coupon_id": user_coupon.user_coupon_id,
        "coupon_id": coupon.coupon_id,
        "coupon_title": coupon.title,
        "coupon_type": coupon.type,
        "store_id": store.store_id,
        "store_name": store.name,
        "used_at": now.isoformat(),
    }
    return JsonResponse(response)


@require_http_methods(["GET"])
def api_user_coupon_history(request):
    user, error = _get_user_from_access_token(request)
    if error:
        return error
    history = (
        UserCouponUsageHistory.objects.select_related("coupon", "store")
        .filter(user=user)
        .order_by("-used_at")
    )
    results = []
    for entry in history:
        results.append(
            {
                "coupon_id": entry.coupon.coupon_id,
                "coupon_title": entry.coupon.title,
                "coupon_type": entry.coupon_type,
                "store_id": entry.store.store_id,
                "store_name": entry.store.name,
                "used_at": entry.used_at.isoformat(),
            }
        )
    return JsonResponse(results, safe=False)


@require_http_methods(["GET"])
def api_user_badges(request):
    user, error = _get_user_from_access_token(request)
    if error:
        return error
    entries = (
        UserBadge.objects.select_related("badge")
        .filter(user=user)
        .order_by("-awarded_at")
    )
    results = []
    for entry in entries:
        results.append(_serialize_badge(entry.badge, awarded_at=entry.awarded_at))
    return JsonResponse(results, safe=False)


@csrf_exempt
@require_http_methods(["POST"])
def api_user_inquiry_create(request):
    user, error = _get_user_from_access_token(request)
    if error:
        return error
    data, error = _get_request_data(request)
    if error:
        return error
    category = (data.get("category") or "").strip() if data else ""
    message = (data.get("message") or "").strip() if data else ""
    store_id = data.get("store_id") if data else None
    related_challenge_id = data.get("related_challenge_id") if data else None

    if not category or not message:
        return _json_error("category and message are required.", status=400)

    store = None
    if store_id:
        try:
            store_id = int(store_id)
            store = Store.objects.filter(store_id=store_id).first()
        except (TypeError, ValueError):
            return _json_error("store_id must be an integer.", status=400)

    related_challenge = None
    if related_challenge_id:
        try:
            related_challenge_id = int(related_challenge_id)
            related_challenge = Challenge.objects.filter(challenge_id=related_challenge_id).first()
        except (TypeError, ValueError):
            return _json_error("related_challenge_id must be an integer.", status=400)

    formatted_message = f"[user_id:{user.user_id}] {user.username} {user.email}\\n{message}"
    inquiry = AdminInquiry.objects.create(
        store=store,
        related_challenge=related_challenge,
        category=category,
        message=formatted_message,
        status="unread",
    )
    return JsonResponse(
        {
            "inquiry_id": inquiry.inquiry_id,
            "category": inquiry.category,
            "message": inquiry.message,
            "status": inquiry.status,
            "created_at": inquiry.created_at.isoformat(),
        },
        status=201,
    )


@require_http_methods(["GET"])
def api_store_coupon_history(request):
    auth_error = _require_phone_api_key(request)
    if auth_error:
        return auth_error
    store_id = request.GET.get("store_id")
    if not store_id:
        return _json_error("store_id is required.", status=400)
    try:
        store_id = int(store_id)
    except (TypeError, ValueError):
        return _json_error("store_id must be an integer.", status=400)
    history = (
        StoreCouponUsageHistory.objects.select_related("coupon", "user", "store")
        .filter(store_id=store_id)
        .order_by("-used_at")
    )
    results = []
    for entry in history:
        results.append(
            {
                "coupon_id": entry.coupon.coupon_id,
                "coupon_title": entry.coupon.title,
                "coupon_type": entry.coupon_type,
                "user_id": entry.user.user_id,
                "username": entry.user.username,
                "store_id": entry.store.store_id,
                "store_name": entry.store.name,
                "used_at": entry.used_at.isoformat(),
            }
        )
    return JsonResponse(results, safe=False)


def public_store_list(request):
    """
    公開用 店舗一覧API
    GET /api/stores?lat=..&lon=..
    """
    auth_error = _require_phone_api_key(request)
    if auth_error:
        return auth_error
    user_lat = request.GET.get("lat")
    user_lon = request.GET.get("lon")
    lat_lon_provided = user_lat is not None and user_lon is not None

    if lat_lon_provided:
        try:
            user_lat_f = float(user_lat)
            user_lon_f = float(user_lon)
        except (TypeError, ValueError):
            return JsonResponse({"detail": "lat/lon は数値で指定してください。"}, status=400)
    else:
        user_lat_f = user_lon_f = None

    stores = (
        Store.objects.filter(status="approved")
        .prefetch_related("storetag_set__tag")
        .order_by("-created_at")
    )

    results = []
    for store in stores:
        distance_km = None
        if lat_lon_provided and store.latitude is not None and store.longitude is not None:
            distance_km = round(
                _haversine_km(
                    user_lat_f,
                    user_lon_f,
                    float(store.latitude),
                    float(store.longitude),
                ),
                3,
            )

        tags = [st.tag.name for st in store.storetag_set.all() if st.tag]

        results.append(
            {
                "id": store.store_id,
                "name": store.name,
                "description": store.store_description or "",
                "lat": float(store.latitude) if store.latitude is not None else None,
                "lon": float(store.longitude) if store.longitude is not None else None,
                "distance": distance_km,  # km
                "tags": tags,
                "main_image": store.main_image or "",
                "phone": store.phone or "",
                "website": store.website or "",
                "instagram": store.instagram or "",
                "business_hours": store.business_hours or "",
                "business_hours_json": store.business_hours_json or {},
                "is_featured": store.is_featured,
                "priority": store.priority,
                "updated_at": store.updated_at.isoformat() if store.updated_at else None,
            }
        )

    return JsonResponse(results, safe=False)


def public_coupon_list(request):
    """
    Public coupon list API.
    GET /api/coupons?store_id=..&type=..
    """
    auth_error = _require_phone_api_key(request)
    if auth_error:
        return auth_error
    store_id = request.GET.get("store_id")
    coupon_type = request.GET.get("type")

    queryset = Coupon.objects.select_related("store").filter(publish_to_shop=True)
    if coupon_type in {"common", "store_specific"}:
        queryset = queryset.filter(type=coupon_type)

    if store_id:
        try:
            store_id_int = int(store_id)
        except (TypeError, ValueError):
            return JsonResponse({"detail": "store_id は整数で指定してください。"}, status=400)
        queryset = queryset.filter(store_id=store_id_int)

    queryset = queryset.filter(Q(store__isnull=True) | Q(store__status="approved")).order_by(
        "-expires_at",
        "-coupon_id",
    )

    results = []
    for coupon in queryset:
        store = coupon.store
        results.append(
            {
                "coupon_id": coupon.coupon_id,
                "title": coupon.title,
                "description": coupon.description or "",
                "required_points": coupon.required_points,
                "type": coupon.type,
                "expires_at": coupon.expires_at.isoformat() if coupon.expires_at else None,
                "store_id": coupon.store_id,
                "store_name": store.name if store else "",
            }
        )

    return JsonResponse(results, safe=False)


@require_http_methods(["GET"])
def public_stamp_setting(request):
    auth_error = _require_phone_api_key(request)
    if auth_error:
        return auth_error
    store_id = request.GET.get("store_id")
    if not store_id:
        return _json_error("store_id is required.", status=400)
    try:
        store_id = int(store_id)
    except (TypeError, ValueError):
        return _json_error("store_id must be an integer.", status=400)

    setting = (
        StoreStampSetting.objects.select_related("store")
        .prefetch_related("rewards", "rewards__reward_coupon")
        .filter(store_id=store_id)
        .first()
    )
    if not setting:
        return JsonResponse({"exists": False, "store_id": store_id})

    rewards = []
    for reward in setting.rewards.all():
        rewards.append(
            {
                "stamp_threshold": reward.stamp_threshold,
                "reward_type": reward.reward_type,
                "reward_coupon_id": reward.reward_coupon_id,
                "reward_coupon_title": reward.reward_coupon.title if reward.reward_coupon else "",
                "reward_service_desc": reward.reward_service_desc or "",
            }
        )

    response = {
        "exists": True,
        "store_id": setting.store.store_id,
        "store_name": setting.store.name,
        "max_stamps": setting.max_stamps,
        "rewards": rewards,
    }

    user, error = _get_user_from_access_token(request)
    if not error and user:
        user_stamp = StoreStamp.objects.filter(user=user, store_id=store_id).first()
        response["user_stamps"] = {
            "stamps_count": user_stamp.stamps_count if user_stamp else 0,
            "reward_given": user_stamp.reward_given if user_stamp else False,
        }

    return JsonResponse(response)


@csrf_exempt
@require_http_methods(["POST"])
def api_store_stamp_scan(request):
    user, error = _get_user_from_access_token(request)
    if error:
        return error
    data, error = _get_request_data(request)
    if error:
        return error

    store_id = data.get("store_id") if data else None
    store_qr = (data.get("store_qr") or "").strip() if data else ""
    if not store_id or not store_qr:
        return _json_error("store_id and store_qr are required.", status=400)
    try:
        store_id = int(store_id)
    except (TypeError, ValueError):
        return _json_error("store_id must be an integer.", status=400)

    store = Store.objects.filter(store_id=store_id).first()
    if not store:
        return _json_error("Store not found.", status=404)
    if store.qr_code != store_qr:
        return _json_error("Store QR does not match.", status=400)

    setting = StoreStampSetting.objects.filter(store_id=store_id).first()
    if not setting:
        return _json_error("Stamp setting not found.", status=404)

    now = timezone.now()
    last_stamp = (
        StoreStampHistory.objects.filter(user=user, store_id=store_id)
        .order_by("-stamped_at")
        .first()
    )
    if last_stamp and (now - last_stamp.stamped_at).total_seconds() < 4 * 3600:
        return _json_error("Already stamped within 4 hours.", status=400)

    StoreStampHistory.objects.create(
        user=user,
        store=store,
        stamp_date=timezone.localdate(),
        stamped_at=now,
    )
    user_stamp, _ = StoreStamp.objects.get_or_create(user=user, store=store)
    user_stamp.stamps_count = (user_stamp.stamps_count or 0) + 1
    user_stamp.save(update_fields=["stamps_count"])

    reward = (
        StoreStampReward.objects.filter(setting=setting, stamp_threshold=user_stamp.stamps_count)
        .select_related("reward_coupon")
        .first()
    )
    reward_payload = {
        "reward_type": "",
        "reward_detail": "",
        "reward_coupon_id": None,
        "reward_coupon_title": "",
    }
    if reward:
        if reward.reward_type == "coupon" and reward.reward_coupon_id:
            user_coupon, _ = UserCoupon.objects.get_or_create(
                user=user,
                coupon=reward.reward_coupon,
                defaults={"is_used": False, "used_at": None},
            )
            reward_payload.update(
                {
                    "reward_type": "coupon",
                    "reward_detail": reward.reward_coupon.title,
                    "reward_coupon_id": reward.reward_coupon.coupon_id,
                    "reward_coupon_title": reward.reward_coupon.title,
                }
            )
        elif reward.reward_type == "service":
            reward_payload.update(
                {
                    "reward_type": "service",
                    "reward_detail": reward.reward_service_desc or "サービス",
                }
            )

    new_badges = _award_badges_for_user(user, store_id=store_id)

    response = {
        "store_id": store.store_id,
        "store_name": store.name,
        "stamps_count": user_stamp.stamps_count,
        "stamped_at": now.isoformat(),
        "new_badges": new_badges,
        **reward_payload,
    }
    return JsonResponse(response, status=201)


def public_challenge_list(request):
    """
    Public challenge list API.
    GET /api/challenges?store_id=..
    """
    auth_error = _require_phone_api_key(request)
    if auth_error:
        return auth_error
    store_id = request.GET.get("store_id")
    queryset = (
        Challenge.objects.select_related("store", "reward_coupon")
        .filter(is_banned=False, store__status="approved")
        .order_by("-created_at")
    )

    if store_id:
        try:
            store_id_int = int(store_id)
        except (TypeError, ValueError):
            return JsonResponse({"detail": "store_id は整数で指定してください。"}, status=400)
        queryset = queryset.filter(store_id=store_id_int)

    results = []
    for challenge in queryset:
        results.append(
            {
                "challenge_id": challenge.challenge_id,
                "title": challenge.title,
                "description": challenge.description or "",
                "reward_points": challenge.reward_points,
                "type": challenge.type,
                "quest_type": challenge.quest_type,
                "reward_type": challenge.reward_type,
                "reward_detail": challenge.reward_detail or "",
                "reward_coupon_id": challenge.reward_coupon_id,
                "store_id": challenge.store_id,
                "store_name": challenge.store.name if challenge.store else "",
                "qr_code": challenge.qr_code or "",
                "created_at": challenge.created_at.isoformat(),
            }
        )

    return JsonResponse(results, safe=False)


@require_http_methods(["GET"])
def public_notice_list(request):
    expected_key = getattr(settings, "PHONE_API_KEY", "")
    provided_key = request.headers.get("phone-API-key") or request.META.get("HTTP_PHONE_API_KEY")
    is_phone_client = bool(expected_key and provided_key and secrets.compare_digest(provided_key, expected_key))

    target = request.GET.get("target")
    if target == "user" and is_phone_client:
        targets = {"all", "user"}
    else:
        targets = {"all"}

    now = timezone.now()
    notices = Notice.objects.filter(
        is_published=True,
        start_at__lte=now,
        end_at__gte=now,
        target__in=targets,
    ).order_by("-start_at", "-created_at")

    results = []
    for notice in notices:
        results.append(
            {
                "notice_id": notice.notice_id,
                "title": notice.title,
                "body_md": notice.body_md,
                "body_html": render_markdown(notice.body_md),
                "target": notice.target,
                "start_at": notice.start_at.isoformat(),
                "end_at": notice.end_at.isoformat(),
            }
        )
    return JsonResponse(results, safe=False)


def signup_view(request):
    sent_to = None
    if request.method == "POST":
        form = OwnerSignupForm(request.POST)
        if form.is_valid():
            owner = StoreOwner.objects.create(
                email=form.cleaned_data["email"].lower(),
                password=make_password(form.cleaned_data["password1"]),
                approved=False,
            )
            owner.is_verified = True
            owner.onboarding_completed = True
            owner.approved = True
            owner.save(update_fields=["is_verified", "onboarding_completed", "approved"])
            request.session.flush()
            request.session["owner_id"] = owner.owner_id
            request.session["admin_authenticated"] = False
            messages.success(request, "新規登録が完了しました。ダッシュボードに移動します。")
            return redirect("owner_dashboard")
    else:
        form = OwnerSignupForm()

    return render(request, "common/signup.html", {"form": form, "sent_to": sent_to})


def admin_signup_view(request):
    if request.method == "POST":
        form = AdminSignupForm(request.POST)
        if form.is_valid():
            AdminAccount.objects.update_or_create(
                email=form.cleaned_data["email"].lower(),
                defaults={
                    "name": form.cleaned_data["name"],
                    "password": make_password(form.cleaned_data["password1"]),
                    "approval_status": "approved",
                    "is_active": True,
                    "is_deleted": False,
                },
            )
            messages.success(request, "運営アカウントを登録しました。ログインしてください。")
            return redirect("login")
    else:
        form = AdminSignupForm()

    return render(request, "common/admin_signup.html", {"form": form})


def signup_verify_view(request):
    token = request.GET.get("token")
    if not token:
        messages.error(request, "確認トークンが無効です。")
        return redirect("signup")

    owner = StoreOwner.objects.filter(verification_token=token).first()
    if not owner:
        messages.error(request, "この確認リンクは無効、または使用済みです。")
        return redirect("signup")

    owner.is_verified = True
    owner.verification_token = None
    owner.save(update_fields=["is_verified", "verification_token"])

    request.session.flush()
    request.session["owner_id"] = owner.owner_id
    request.session["admin_authenticated"] = False

    if owner.onboarding_completed:
        messages.success(request, "メール確認が完了しました。")
        return redirect("owner_dashboard")

    messages.success(request, "メール確認が完了しました。アカウント設定に進んでください。")
    return redirect("owner_onboarding")


def onboarding_view(request):
    owner_id = request.session.get("owner_id")
    if not owner_id:
        messages.error(request, "アカウント設定を行うにはログインしてください。")
        return redirect("login")

    owner = StoreOwner.objects.filter(pk=owner_id).first()
    if not owner:
        request.session.flush()
        return redirect("login")

    if not owner.is_verified:
        messages.error(request, "メール確認を完了した後に設定を行ってください。")
        return redirect("signup")

    if owner.onboarding_completed and owner.contact_phone:
        return redirect("owner_dashboard")

    initial = {
        "name": owner.name or owner.email.split("@")[0],
        "business_name": owner.business_name,
        "contact_phone": owner.contact_phone,
    }

    needs_phone = not owner.contact_phone
    if request.method == "POST":
        form = OwnerProfileForm(request.POST)
        if needs_phone:
            form.fields["contact_phone"].required = True
        if form.is_valid():
            owner.name = form.cleaned_data["name"]
            owner.business_name = form.cleaned_data["business_name"]
            owner.contact_phone = form.cleaned_data["contact_phone"]
            owner.onboarding_completed = True
            owner.approved = True
            owner.save(
                update_fields=["name", "business_name", "contact_phone", "onboarding_completed", "approved"]
            )
            messages.success(
                request,
                "アカウント設定が完了しました。運営の審査が完了次第ダッシュボードをご利用いただけます。",
            )
            return redirect("owner_dashboard")
    else:
        form = OwnerProfileForm(initial=initial)
        if needs_phone:
            form.fields["contact_phone"].required = True

    return render(request, "common/onboarding.html", {"form": form, "owner": owner})


def _send_verification_email(request, owner):
    token = secrets.token_urlsafe(32)
    owner.verification_token = token
    owner.verification_sent_at = timezone.now()
    owner.save(update_fields=["verification_token", "verification_sent_at"])

    verify_url = request.build_absolute_uri(f"{reverse('signup_verify')}?token={token}")
    subject = "【CiQuest】オーナー登録のメール確認"
    message = (
        "CiQuest（シークエスト）にご登録いただきありがとうございます。\n"
        "以下のリンクをクリックしてメールアドレスの確認を完了させてください。\n\n"
        f"{verify_url}\n\n"
        "※本メールに心当たりがない場合は破棄してください。"
    )
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None) or getattr(settings, "EMAIL_HOST_USER", None)
    if not from_email:
        from_email = "no-reply@ciquest.local"

    try:
        send_mail(subject, message, from_email, [owner.email], fail_silently=False)
        return True
    except Exception:
        return False

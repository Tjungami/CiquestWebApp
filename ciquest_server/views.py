import datetime
import hashlib
import json
import math
import secrets

import jwt

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import logout as django_logout
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import get_connection, send_mail
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from ciquest_model.models import (
    AdminAccount,
    Challenge,
    Coupon,
    Notice,
    Store,
    StoreOwner,
    StoreTag,
    StoreStamp,
    StoreStampSetting,
    Tag,
    User,
    UserChallenge,
    UserCoupon,
    UserCouponUsageHistory,
    StoreCouponUsageHistory,
    UserRefreshToken,
)
from ciquest_model.markdown_utils import render_markdown
from ciquest_server.forms import AdminSignupForm, OwnerProfileForm, OwnerSignupForm


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
        "points": user.points,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


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

    reward_points_awarded = 0
    reward_coupon = None
    reward_granted = False
    if challenge.reward_type == "points":
        if challenge.reward_points:
            reward_points_awarded = challenge.reward_points
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

    if owner.onboarding_completed:
        return redirect("owner_dashboard")

    initial = {
        "name": owner.name or owner.email.split("@")[0],
        "business_name": owner.business_name,
        "contact_phone": owner.contact_phone,
    }

    if request.method == "POST":
        form = OwnerProfileForm(request.POST)
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

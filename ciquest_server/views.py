import secrets
import math

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import logout as django_logout
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import get_connection, send_mail
from django.db.models import Q
from django.shortcuts import redirect, render
from django.http import JsonResponse
from django.urls import reverse
from django.utils import timezone

from ciquest_model.models import AdminAccount, StoreOwner
from ciquest_model.models import AdminAccount, Store, StoreTag, Tag, Coupon, Challenge
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


def _require_phone_api_key(request):
    expected_key = getattr(settings, "PUBLIC_API_KEY", "")
    if not expected_key:
        return None
    provided_key = request.headers.get("phone-API-key") or request.META.get("HTTP_PHONE_API_KEY")
    if not provided_key or not secrets.compare_digest(provided_key, expected_key):
        return JsonResponse({"detail": "認証に失敗しました。"}, status=401)
    return None


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
                "created_at": challenge.created_at.isoformat(),
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

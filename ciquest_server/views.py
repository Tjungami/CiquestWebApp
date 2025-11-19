import secrets

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import logout as django_logout
from django.core.mail import send_mail
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils import timezone

from ciquest_model.models import AdminAccount, StoreOwner
from ciquest_server.forms import OwnerProfileForm, OwnerSignupForm


def unified_login(request):
    error = None
    if request.method == "POST":
        identifier = (request.POST.get("identifier") or "").strip()
        password = request.POST.get("password") or ""

        owner = StoreOwner.objects.filter(email__iexact=identifier).first()
        if owner and owner.password == password:
            if not owner.is_verified:
                error = "メール認証が完了していません。メール内のリンクをクリックしてください。"
            elif not owner.onboarding_completed:
                request.session.flush()
                request.session["owner_id"] = owner.owner_id
                request.session["admin_authenticated"] = False
                messages.info(request, "アカウント設定を完了してください。")
                return redirect("owner_onboarding")
            elif owner.approved:
                request.session.flush()
                request.session["owner_id"] = owner.owner_id
                request.session["admin_authenticated"] = False
                return redirect("owner_dashboard")
            else:
                error = "現在、運営による店舗審査中です。しばらくお待ちください。"
        else:
            admin = AdminAccount.objects.filter(email__iexact=identifier, is_active=True).first()
            if admin and admin.password == password:
                request.session.flush()
                request.session["admin_authenticated"] = True
                return redirect("admin_dashboard")

            error = "メールアドレスまたはパスワードが正しくありません。"

    return render(request, "common/login.html", {"error": error})


def unified_logout(request):
    django_logout(request)
    request.session.flush()
    return redirect("login")


def signup_view(request):
    sent_to = None
    if request.method == "POST":
        form = OwnerSignupForm(request.POST)
        if form.is_valid():
            owner = StoreOwner.objects.create(
                email=form.cleaned_data["email"].lower(),
                password=form.cleaned_data["password1"],
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

import json
import secrets
from datetime import datetime, time

from django.conf import settings
from django.core.mail import send_mail
from django.contrib.auth.hashers import make_password
from django.db.models import Q
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.views.decorators.http import require_http_methods

from ciquest_model.models import (
    AdminAccount,
    AdminInquiry,
    Challenge,
    Coupon,
    Notice,
    Store,
    StoreOwner,
    User,
)
from ciquest_model.markdown_utils import render_markdown


def login_view(request):
    return redirect("login")


def _get_current_admin(request):
    admin_id = request.session.get("admin_id")
    if not admin_id:
        return None
    return AdminAccount.objects.filter(
        pk=admin_id, is_active=True, approval_status="approved"
    ).first()


def _ensure_admin(request):
    admin = _get_current_admin(request)
    if admin:
        request.current_admin = admin
        return True
    return False


def _redirect_if_not_admin(request):
    if not _ensure_admin(request):
        return redirect("login")
    return None


def admin_dashboard(request):
    redirect_response = _redirect_if_not_admin(request)
    if redirect_response:
        return redirect_response

    pending_stores_qs = Store.objects.filter(status="pending").order_by("-created_at")
    latest_challenges = Challenge.objects.select_related("store").order_by("-created_at")[:3]
    latest_coupons = Coupon.objects.filter(type="common").order_by("expires_at", "-coupon_id")[:3]
    open_inquiries = (
        AdminInquiry.objects.select_related("store")
        .filter(~Q(status="resolved"))
        .order_by("-created_at")[:3]
    )

    context = {
        "active_page": "dashboard",
        "summary_pending_stores": pending_stores_qs.count(),
        "summary_challenges": Challenge.objects.count(),
        "summary_coupons": Coupon.objects.filter(type="common").count(),
        "summary_inquiries": AdminInquiry.objects.filter(status="unread").count(),
        "snapshot_pending_stores": pending_stores_qs[:3],
        "snapshot_challenges": latest_challenges,
        "snapshot_coupons": latest_coupons,
        "snapshot_inquiries": open_inquiries,
    }
    return render(request, "admin_panel/dashboard.html", context)


def stores_dashboard(request):
    redirect_response = _redirect_if_not_admin(request)
    if redirect_response:
        return redirect_response
    return render(request, "admin_panel/stores.html", {"active_page": "stores"})


def store_detail(request, store_id):
    redirect_response = _redirect_if_not_admin(request)
    if redirect_response:
        return redirect_response

    store = get_object_or_404(Store.objects.select_related("owner"), pk=store_id)
    return render(
        request,
        "admin_panel/store_detail.html",
        {"active_page": "stores", "store": store, "owner": store.owner},
    )


def challenges_dashboard(request):
    redirect_response = _redirect_if_not_admin(request)
    if redirect_response:
        return redirect_response
    return render(request, "admin_panel/challenges.html", {"active_page": "challenges"})


def coupons_dashboard(request):
    redirect_response = _redirect_if_not_admin(request)
    if redirect_response:
        return redirect_response
    return render(request, "admin_panel/coupons.html", {"active_page": "coupons"})


def inquiries_dashboard(request):
    redirect_response = _redirect_if_not_admin(request)
    if redirect_response:
        return redirect_response
    return render(request, "admin_panel/inquiries.html", {"active_page": "inquiries"})




def admins_dashboard(request):
    redirect_response = _redirect_if_not_admin(request)
    if redirect_response:
        return redirect_response
    return render(request, "admin_panel/admins.html", {"active_page": "admins"})


def users_dashboard(request):
    redirect_response = _redirect_if_not_admin(request)
    if redirect_response:
        return redirect_response
    return render(request, "admin_panel/users.html", {"active_page": "users"})


def _json_unauthorized():
    return JsonResponse({"detail": "認証が必要です。"}, status=401)


def _require_admin_for_json(request):
    if not _ensure_admin(request):
        return _json_unauthorized()
    return None


def _json_body(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}


def _serialize_admin(account, current_admin=None):
    creator = account.created_by
    approver = account.approved_by
    return {
        "admin_id": account.admin_id,
        "name": account.name,
        "email": account.email,
        "approval_status": account.approval_status,
        "is_deleted": account.is_deleted,
        "created_by": creator.name if creator else "",
        "approved_by": approver.name if approver else "",
        "created_at": account.created_at.isoformat(),
        "approved_at": account.approved_at.isoformat() if account.approved_at else None,
        "is_active": account.is_active,
        "can_approve": False,
    }


def _serialize_user(user):
    return {
        "user_id": user.user_id,
        "username": user.username,
        "email": user.email,
        "rank": user.rank.name if user.rank else "",
        "points": user.points,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@require_http_methods(["GET", "POST"])
def api_admin_list_create(request):
    unauthorized = _require_admin_for_json(request)
    if unauthorized:
        return unauthorized

    current_admin = getattr(request, "current_admin", None) or _get_current_admin(request)
    if request.method == "GET":
        now = timezone.now()
        admins = (
            AdminAccount.objects.select_related("created_by", "approved_by")
            # 期限切れの削除済みアカウントは一覧から除外
            .exclude(is_deleted=True, restore_token_expires_at__isnull=False, restore_token_expires_at__lt=now)
            .order_by("-created_at")
        )
        data = [_serialize_admin(admin, current_admin) for admin in admins]
        return JsonResponse(data, safe=False)

    data = _json_body(request)
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "").strip()
    if not name or not email or not password:
        return JsonResponse({"detail": "氏名・メールアドレス・パスワードを入力してください。"}, status=400)
    if len(password) < 8:
        return JsonResponse({"detail": "パスワードは8文字以上で入力してください。"}, status=400)
    hashed_password = make_password(password)

    existing = AdminAccount.objects.filter(email__iexact=email).first()
    if existing:
        if existing.is_deleted:
            existing.name = name
            existing.password = hashed_password
            existing.approval_status = "approved"
            existing.is_active = True
            existing.is_deleted = False
            existing.restore_token = None
            existing.restore_token_expires_at = None
            existing.deleted_at = None
            existing.created_by = existing.created_by or current_admin
            existing.approved_by = current_admin
            existing.approved_at = timezone.now()
            existing.save(
                update_fields=[
                    "name",
                    "password",
                    "approval_status",
                    "is_active",
                    "is_deleted",
                    "restore_token",
                    "restore_token_expires_at",
                    "deleted_at",
                    "created_by",
                    "approved_by",
                    "approved_at",
                ]
            )
            return JsonResponse({"admin_id": existing.admin_id, "reactivated": True}, status=200)
        return JsonResponse({"detail": "同じメールアドレスの運営アカウントが既に存在します。"}, status=400)

    admin = AdminAccount.objects.create(
        name=name,
        email=email,
        password=hashed_password,
        approval_status="approved",
        is_active=True,
        created_by=current_admin,
        approved_by=current_admin,
        approved_at=timezone.now(),
    )
    return JsonResponse({"admin_id": admin.admin_id}, status=201)


@require_http_methods(["POST"])
def api_admin_approve(request, admin_id):
    # Two-person approvalは廃止。エンドポイントは互換のため残し、権限チェックのみ行う。
    unauthorized = _require_admin_for_json(request)
    if unauthorized:
        return unauthorized
    return JsonResponse({"detail": "このエンドポイントは現在利用していません。新規作成は一覧画面で直接行ってください。"}, status=400)


@require_http_methods(["DELETE"])
def api_admin_delete(request, admin_id):
    unauthorized = _require_admin_for_json(request)
    if unauthorized:
        return unauthorized

    current_admin = getattr(request, "current_admin", None) or _get_current_admin(request)
    target = get_object_or_404(AdminAccount, pk=admin_id)

    if current_admin and target.admin_id == current_admin.admin_id:
        return JsonResponse({"detail": "自分自身のアカウントは削除できません。"}, status=400)

    token = secrets.token_urlsafe(32)
    expires_at = timezone.now() + timezone.timedelta(hours=24)

    target.is_deleted = True
    target.is_active = False
    target.deleted_at = timezone.now()
    target.restore_token = token
    target.restore_token_expires_at = expires_at
    target.save(update_fields=["is_deleted", "is_active", "deleted_at", "restore_token", "restore_token_expires_at"])

    restore_url = request.build_absolute_uri(
        reverse("admin_account_restore", kwargs={"admin_id": target.admin_id, "token": token})
    )
    subject = "【Ciquest】運営アカウント削除と復元リンク（24時間有効）"
    body = (
        f"{target.name} 様\n\n"
        "運営アカウントが削除されました。24時間以内であれば以下のリンクから復元できます。\n\n"
        f"{restore_url}\n\n"
        "心当たりがない場合は、他の運営に連絡しパスワード変更などの対応をしてください。"
    )
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None) or getattr(settings, "EMAIL_HOST_USER", None) or "no-reply@ciquest.local"

    try:
        send_mail(subject, body, from_email, [target.email], fail_silently=False)
    except Exception as exc:
        return JsonResponse({"detail": f"削除は完了しましたがメール送信に失敗しました: {exc}"}, status=500)

    return JsonResponse({"detail": "削除しました。復元リンクをメール送信しました。"})


@require_http_methods(["GET"])
def admin_account_restore(request, admin_id, token):
    target = get_object_or_404(AdminAccount, pk=admin_id)
    if not target.is_deleted or not target.restore_token:
        return JsonResponse({"detail": "このアカウントは削除されていません。"}, status=400)
    if token != target.restore_token:
        return JsonResponse({"detail": "無効なトークンです。"}, status=400)
    if target.restore_token_expires_at and timezone.now() > target.restore_token_expires_at:
        return JsonResponse({"detail": "復元リンクの有効期限が切れています。"}, status=400)

    target.is_deleted = False
    target.is_active = True
    target.restore_token = None
    target.restore_token_expires_at = None
    target.deleted_at = None
    target.save(update_fields=["is_deleted", "is_active", "restore_token", "restore_token_expires_at", "deleted_at"])

    html = f"""
    <html>
      <head>
        <meta charset="utf-8">
        <title>復元完了</title>
      </head>
      <body>
        <h1>アカウントを復元しました</h1>
        <p>{target.name} 様の運営アカウントを復元しました。ログインし直してください。</p>
        <p><a href="/login/">ログインページへ</a></p>
      </body>
    </html>
    """
    return HttpResponse(html, content_type="text/html; charset=utf-8")


@require_http_methods(["GET"])
def api_store_list(request):
    unauthorized = _require_admin_for_json(request)
    if unauthorized:
        return unauthorized

    status_filter = request.GET.get("status")
    queryset = Store.objects.select_related("owner").order_by("-created_at")
    if status_filter in {"pending", "approved", "rejected"}:
        queryset = queryset.filter(status=status_filter)

    stores = [
        {
            "store_id": store.store_id,
            "name": store.name,
            "address": store.address or "",
            "created_at": store.created_at.isoformat(),
            "owner_name": store.owner.name if store.owner else "",
            "status": store.status,
        }
        for store in queryset
    ]
    return JsonResponse(stores, safe=False)


@require_http_methods(["POST"])
def api_store_update_status(request, store_id, new_status):
    unauthorized = _require_admin_for_json(request)
    if unauthorized:
        return unauthorized

    if new_status not in {"pending", "approved", "rejected"}:
        return JsonResponse({"detail": "不正な状態です。"}, status=400)

    store = get_object_or_404(Store, pk=store_id)
    store.status = new_status
    store.save(update_fields=["status"])
    return JsonResponse({"detail": "更新しました。", "status": new_status})


@require_http_methods(["DELETE"])
def api_store_delete(request, store_id):
    unauthorized = _require_admin_for_json(request)
    if unauthorized:
        return unauthorized

    store = get_object_or_404(Store, pk=store_id)
    if store.status != "approved":
        return JsonResponse({"detail": "承認済みの店舗のみ削除できます。"}, status=400)

    store.delete()
    return JsonResponse({"detail": "削除しました。"})


@require_http_methods(["GET"])
def api_challenge_list(request):
    unauthorized = _require_admin_for_json(request)
    if unauthorized:
        return unauthorized

    keyword = (request.GET.get("search") or "").strip()
    queryset = Challenge.objects.select_related("store").order_by("-created_at")
    if keyword:
        queryset = queryset.filter(
            Q(title__icontains=keyword) | Q(store__name__icontains=keyword)
        )

    challenges = [
        {
            "challenge_id": challenge.challenge_id,
            "title": challenge.title,
            "store_name": challenge.store.name if challenge.store else "",
            "reward_points": challenge.reward_points,
            "is_banned": challenge.is_banned,
            "created_at": challenge.created_at.isoformat(),
        }
        for challenge in queryset
    ]
    return JsonResponse(challenges, safe=False)


@require_http_methods(["POST"])
def api_challenge_ban(request, challenge_id):
    unauthorized = _require_admin_for_json(request)
    if unauthorized:
        return unauthorized

    challenge = get_object_or_404(Challenge, pk=challenge_id)
    challenge.is_banned = True
    challenge.save(update_fields=["is_banned"])
    return JsonResponse({"detail": "BAN済みにしました。"})


@require_http_methods(["GET", "POST"])
def api_coupon_list_create(request):
    unauthorized = _require_admin_for_json(request)
    if unauthorized:
        return unauthorized

    if request.method == "GET":
        coupon_type = request.GET.get("type")
        queryset = (
            Coupon.objects.select_related("store")
            .order_by("-expires_at", "-coupon_id")
        )
        if coupon_type in {"common", "store_specific"}:
            queryset = queryset.filter(type=coupon_type)

        coupons = [
            {
                "coupon_id": coupon.coupon_id,
                "title": coupon.title,
                "description": coupon.description or "",
                "required_points": coupon.required_points,
                "expires_at": coupon.expires_at.isoformat() if coupon.expires_at else None,
                "type": coupon.type,
                "store_id": coupon.store_id,
                "store_name": coupon.store.name if coupon.store else "",
            }
            for coupon in queryset
        ]
        return JsonResponse(coupons, safe=False)

    data = _json_body(request)
    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    required_points = data.get("required_points")
    expires_at_raw = data.get("expires_at")
    if not title or not description or not required_points or not expires_at_raw:
        return JsonResponse({"detail": "必要な値が不足しています。"}, status=400)

    expires_date = parse_date(expires_at_raw)
    if not expires_date:
        return JsonResponse({"detail": "有効期限の日付形式が不正です。"}, status=400)

    expires_dt = datetime.combine(expires_date, time.max)
    expires_aware = timezone.make_aware(expires_dt) if timezone.is_naive(expires_dt) else expires_dt

    try:
        required_points_int = int(required_points)
    except (TypeError, ValueError):
        return JsonResponse({"detail": "ポイントは1以上の整数で指定してください。"}, status=400)
    if required_points_int < 1:
        return JsonResponse({"detail": "ポイントは1以上の整数で指定してください。"}, status=400)

    coupon = Coupon.objects.create(
        title=title,
        description=description,
        required_points=required_points_int,
        type=data.get("type", "common"),
        expires_at=expires_aware,
    )
    return JsonResponse({"coupon_id": coupon.coupon_id}, status=201)


@require_http_methods(["POST"])
def api_coupon_update_points(request, coupon_id):
    unauthorized = _require_admin_for_json(request)
    if unauthorized:
        return unauthorized

    coupon = get_object_or_404(Coupon, pk=coupon_id)
    data = _json_body(request)
    try:
        required_points = int(data.get("required_points"))
    except (TypeError, ValueError):
        return JsonResponse({"detail": "ポイントは1以上の整数で指定してください。"}, status=400)

    if required_points < 1:
        return JsonResponse({"detail": "ポイントは1以上の整数で指定してください。"}, status=400)

    coupon.required_points = required_points
    coupon.save(update_fields=["required_points"])
    return JsonResponse({"detail": "更新しました。"})


@require_http_methods(["DELETE"])
def api_coupon_delete(request, coupon_id):
    unauthorized = _require_admin_for_json(request)
    if unauthorized:
        return unauthorized

    coupon = get_object_or_404(Coupon, pk=coupon_id)
    coupon.delete()
    return JsonResponse({"detail": "削除しました。"})


@require_http_methods(["GET"])
def api_inquiry_list(request):
    unauthorized = _require_admin_for_json(request)
    if unauthorized:
        return unauthorized

    status_filter = request.GET.get("status")
    queryset = AdminInquiry.objects.select_related("store", "related_challenge").order_by("-created_at")
    if status_filter in {"unread", "in_progress", "resolved"}:
        queryset = queryset.filter(status=status_filter)

    inquiries = [
        {
            "inquiry_id": inquiry.inquiry_id,
            "category": inquiry.category,
            "message": inquiry.message,
            "status": inquiry.status,
            "created_at": inquiry.created_at.isoformat(),
            "store_name": inquiry.store.name if inquiry.store else "",
            "related_challenge_id": inquiry.related_challenge_id,
        }
        for inquiry in queryset
    ]
    return JsonResponse(inquiries, safe=False)


@require_http_methods(["POST"])
def api_inquiry_update_status(request, inquiry_id):
    unauthorized = _require_admin_for_json(request)
    if unauthorized:
        return unauthorized

    data = _json_body(request)
    next_status = data.get("status")
    if next_status not in {"unread", "in_progress", "resolved"}:
        return JsonResponse({"detail": "不正な状態です。"}, status=400)

    inquiry = get_object_or_404(AdminInquiry, pk=inquiry_id)
    inquiry.status = next_status
    inquiry.save(update_fields=["status"])
    return JsonResponse({"detail": "更新しました。", "status": next_status})


@require_http_methods(["GET"])
def api_user_list(request):
    unauthorized = _require_admin_for_json(request)
    if unauthorized:
        return unauthorized

    keyword = (request.GET.get("search") or "").strip()
    queryset = User.objects.select_related("rank").order_by("-created_at")
    if keyword:
        queryset = queryset.filter(
            Q(username__icontains=keyword) | Q(email__icontains=keyword)
        )
    users = [_serialize_user(user) for user in queryset]
    return JsonResponse(users, safe=False)


@require_http_methods(["DELETE"])
def api_user_delete(request, user_id):
    unauthorized = _require_admin_for_json(request)
    if unauthorized:
        return unauthorized

    user = get_object_or_404(User, pk=user_id)
    user.delete()
    return JsonResponse({"detail": "削除しました。"})


def notices_dashboard(request):
    redirect_response = _redirect_if_not_admin(request)
    if redirect_response:
        return redirect_response
    return render(request, "admin_panel/notices.html", {"active_page": "notices"})


def _parse_datetime_local(value):
    if not value:
        return None
    try:
        parsed = datetime.strptime(value, "%Y-%m-%dT%H:%M")
    except ValueError:
        return None
    if timezone.is_naive(parsed):
        return timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed


def _normalize_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"true", "1", "yes", "on"}
    return False


def _serialize_notice(notice, include_body_html=False):
    data = {
        "notice_id": notice.notice_id,
        "title": notice.title,
        "body_md": notice.body_md,
        "target": notice.target,
        "start_at": notice.start_at.isoformat(),
        "end_at": notice.end_at.isoformat(),
        "is_published": notice.is_published,
        "created_at": notice.created_at.isoformat(),
    }
    if include_body_html:
        data["body_html"] = render_markdown(notice.body_md)
    return data


@require_http_methods(["GET", "POST"])
def api_notice_list_create(request):
    unauthorized = _require_admin_for_json(request)
    if unauthorized:
        return unauthorized

    if request.method == "GET":
        notices = Notice.objects.order_by("-start_at", "-created_at")
        data = [_serialize_notice(notice, include_body_html=True) for notice in notices]
        return JsonResponse(data, safe=False)

    data = _json_body(request)
    title = (data.get("title") or "").strip()
    body_md = (data.get("body_md") or "").strip()
    target = data.get("target")
    start_at = _parse_datetime_local(data.get("start_at"))
    end_at = _parse_datetime_local(data.get("end_at"))
    is_published = _normalize_bool(data.get("is_published"))

    if not title or not body_md or not target or not start_at or not end_at:
        return JsonResponse({"detail": "必須項目が不足しています。"}, status=400)
    if target not in {"all", "owner", "user"}:
        return JsonResponse({"detail": "対象が不正です。"}, status=400)
    if start_at > end_at:
        return JsonResponse({"detail": "終了日時は開始日時より後に設定してください。"}, status=400)

    current_admin = getattr(request, "current_admin", None) or _get_current_admin(request)
    notice = Notice.objects.create(
        title=title,
        body_md=body_md,
        target=target,
        start_at=start_at,
        end_at=end_at,
        is_published=is_published,
        created_by=current_admin,
    )
    return JsonResponse({"notice_id": notice.notice_id}, status=201)


@require_http_methods(["DELETE"])
def api_notice_delete(request, notice_id):
    unauthorized = _require_admin_for_json(request)
    if unauthorized:
        return unauthorized

    notice = get_object_or_404(Notice, pk=notice_id)
    notice.delete()
    return JsonResponse({"detail": "削除しました。"})


def _serialize_owner(owner):
    return {
        "owner_id": owner.owner_id,
        "name": owner.name or "",
        "business_name": owner.business_name or "",
        "email": owner.email,
        "approved": owner.approved,
        "is_verified": owner.is_verified,
        "onboarding_completed": owner.onboarding_completed,
        "created_at": owner.created_at.isoformat(),
    }


@require_http_methods(["GET"])
def api_owner_list(request):
    unauthorized = _require_admin_for_json(request)
    if unauthorized:
        return unauthorized

    keyword = (request.GET.get("search") or "").strip()
    queryset = StoreOwner.objects.order_by("-created_at")
    if keyword:
        queryset = queryset.filter(
            Q(name__icontains=keyword)
            | Q(email__icontains=keyword)
            | Q(business_name__icontains=keyword)
        )
    owners = [_serialize_owner(owner) for owner in queryset]
    return JsonResponse(owners, safe=False)


@require_http_methods(["DELETE"])
def api_owner_delete(request, owner_id):
    unauthorized = _require_admin_for_json(request)
    if unauthorized:
        return unauthorized

    owner = get_object_or_404(StoreOwner, pk=owner_id)
    owner.delete()
    return JsonResponse({"detail": "削除しました。"})

import json
from datetime import datetime, time

from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.views.decorators.http import require_http_methods

from ciquest_model.models import (
    AdminInquiry,
    Challenge,
    Coupon,
    Store,
)


def login_view(request):
    return redirect("login")


def _ensure_admin(request):
    return bool(request.session.get("admin_authenticated"))


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
        coupon_type = request.GET.get("type") or "common"
        queryset = Coupon.objects.filter(type=coupon_type).order_by("-expires_at")
        coupons = [
            {
                "coupon_id": coupon.coupon_id,
                "title": coupon.title,
                "description": coupon.description or "",
                "required_points": coupon.required_points,
                "expires_at": coupon.expires_at.isoformat() if coupon.expires_at else None,
                "type": coupon.type,
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

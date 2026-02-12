# C:\Users\j_tagami\CiquestWebApp\owner\views.py
import datetime
import uuid

from django.shortcuts import render, get_object_or_404, redirect
from django.db import transaction
from django.db.models import Count, Sum
from django.utils import timezone
from django.utils.safestring import mark_safe
from ciquest_model.models import (
    Store,
    StoreOwner,
    Challenge,
    Coupon,
    AdminInquiry,
    Notice,
    UserChallenge,
    StoreStamp,
    StoreStampHistory,
    StoreCouponUsageHistory,
    StoreStampSetting,
    StoreStampReward,
)
from ciquest_model.markdown_utils import render_markdown
from django.contrib.auth import logout
from django.contrib import messages
from django.views.decorators.http import require_POST
from .forms import ChallengeForm, CouponForm, StampEventForm, StoreApplicationForm


def _get_owner_store(request):
    owner_id = request.session.get("owner_id")
    user = getattr(request, "user", None)
    if not owner_id and getattr(user, "is_authenticated", False):
        owner_id = user.id
    if not owner_id:
        return None
    return Store.objects.filter(owner_id=owner_id).first()


def _generate_unique_qr_code():
    while True:
        code = uuid.uuid4().hex[:10].upper()
        if not Challenge.objects.filter(qr_code=code).exists():
            return code


def _generate_unique_store_qr_code():
    while True:
        code = uuid.uuid4().hex[:12].upper()
        if not Store.objects.filter(qr_code=code).exists():
            return code


def _get_active_owner_notices():
    now = timezone.now()
    notices = (
        Notice.objects.filter(
            is_published=True,
            start_at__lte=now,
            end_at__gte=now,
            target__in=["all", "owner"],
        )
        .order_by("-start_at", "-created_at")
    )
    for notice in notices:
        notice.body_html = mark_safe(render_markdown(notice.body_md))
    return notices


def _submit_owner_inquiry(request, owner):
    store_id = (request.POST.get("store_id") or "").strip()
    category = (request.POST.get("category") or "").strip()
    message = (request.POST.get("message") or "").strip()
    related_challenge_id = (request.POST.get("related_challenge_id") or "").strip()

    has_error = False
    if not store_id or not category or not message:
        messages.error(request, "お問い合わせは店舗・カテゴリ・内容が必須です。")
        has_error = True
    elif not store_id.isdigit():
        messages.error(request, "店舗IDが不正です。")
        has_error = True
    else:
        store = Store.objects.filter(pk=int(store_id), owner=owner).first()
        if not store:
            messages.error(request, "指定した店舗が見つかりません。")
            has_error = True
        else:
            related_challenge = None
            if related_challenge_id:
                if not related_challenge_id.isdigit():
                    messages.error(request, "関連チャレンジIDが不正です。")
                    has_error = True
                else:
                    related_challenge_id = int(related_challenge_id)
                    related_challenge = Challenge.objects.filter(
                        pk=related_challenge_id,
                        store=store,
                    ).first()
                    if not related_challenge:
                        messages.error(request, "指定したチャレンジが見つかりません。")
                        has_error = True
            if not has_error:
                AdminInquiry.objects.create(
                    store=store,
                    related_challenge=related_challenge,
                    category=category,
                    message=message,
                )
                messages.success(request, "お問い合わせを送信しました。")
                return True
    return False



def login_view(request):
    return redirect('login')

def dashboard(request):
    """オーナーダッシュボード"""
    owner_id = request.session.get("owner_id")
    if not owner_id:
        return redirect("login")

    owner = get_object_or_404(StoreOwner, pk=owner_id)
    stores = Store.objects.filter(owner=owner).order_by("-created_at")
    notices = _get_active_owner_notices()
    latest_notice = notices.first()

    return render(
        request,
        "owner/dashboard.html",
        {
            "owner": owner,
            "store_count": stores.count(),
            "approved_store_count": stores.filter(status="approved").count(),
            "pending_store_count": stores.filter(status="pending").count(),
            "notice_count": notices.count(),
            "latest_notice": latest_notice,
        },
    )


def owner_store_application(request):
    owner_id = request.session.get("owner_id")
    if not owner_id:
        return redirect("login")

    owner = get_object_or_404(StoreOwner, pk=owner_id)
    if request.method == "POST":
        if not owner.contact_phone:
            messages.error(request, "店舗申請には連絡先電話番号が必要です。先にオーナー情報で電話番号を登録してください。")
            return redirect("owner_onboarding")

        application_form = StoreApplicationForm(request.POST)
        if application_form.is_valid():
            new_store = application_form.save(commit=False)
            new_store.owner = owner
            new_store.status = "pending"
            new_store.qr_code = _generate_unique_store_qr_code()
            new_store.save()
            messages.success(request, "店舗申請を受け付けました。審査結果をお待ちください。")
            return redirect("owner_store_application")
        messages.error(request, f"Store application failed: {application_form.errors}")
    else:
        application_form = StoreApplicationForm()

    return render(
        request,
        "owner/store_application.html",
        {
            "owner": owner,
            "application_form": application_form,
        },
    )


def owner_stores(request):
    owner_id = request.session.get("owner_id")
    if not owner_id:
        return redirect("login")

    owner = get_object_or_404(StoreOwner, pk=owner_id)
    stores = Store.objects.filter(owner=owner).order_by("-created_at")
    return render(
        request,
        "owner/stores.html",
        {
            "owner": owner,
            "stores": stores,
        },
    )


def owner_notices(request):
    owner_id = request.session.get("owner_id")
    if not owner_id:
        return redirect("login")

    owner = get_object_or_404(StoreOwner, pk=owner_id)
    notices = _get_active_owner_notices()

    return render(
        request,
        "owner/notices.html",
        {
            "owner": owner,
            "notices": notices,
        },
    )


def owner_inquiries(request):
    owner_id = request.session.get("owner_id")
    if not owner_id:
        return redirect("login")

    owner = get_object_or_404(StoreOwner, pk=owner_id)
    stores = Store.objects.filter(owner=owner).order_by("-created_at")
    if request.method == "POST":
        if _submit_owner_inquiry(request, owner):
            return redirect("owner_inquiries")

    return render(
        request,
        "owner/inquiries.html",
        {
            "owner": owner,
            "stores": stores,
        },
    )


def store_home(request, store_id):
    """店舗ごとのホーム画面"""
    owner_id = request.session.get("owner_id")
    if not owner_id:
        return redirect("login")

    store = get_object_or_404(Store, pk=store_id)
    return render(request, "owner/home.html", {"store": store})


def logout_view(request):
    """ログアウト"""
    logout(request)
    request.session.flush()
    return redirect("login")


def create_challenge(request):
    store = _get_owner_store(request)
    if not store:
        messages.error(request, "店舗情報が見つかりません。先に店舗登録を完了してください。")
        return redirect("owner_dashboard")

    challenge_limit = 5
    current_challenges = Challenge.objects.filter(store=store).count()
    limit_reached = current_challenges >= challenge_limit

    coupons = Coupon.objects.filter(store=store)

    if request.method == 'POST':
        if limit_reached:
            messages.error(request, f"チャレンジは最大{challenge_limit}件まで登録できます。既存のチャレンジを削除してください。")
            return redirect('my_challenges')
        form = ChallengeForm(request.POST)
    else:
        form = ChallengeForm()

    if 'reward_coupon' in form.fields:
        form.fields['reward_coupon'].queryset = coupons
        form.fields['reward_coupon'].empty_label = "クーポンを選択"

    if request.method == 'POST' and form.is_valid():
        challenge = form.save(commit=False)
        challenge.store = store
        # Enforce: exactly one common challenge per store.
        existing_common = Challenge.objects.filter(store=store, quest_type='common')
        if challenge.quest_type == 'common':
            if existing_common.exists():
                form.add_error('quest_type', "共通チャレンジは1店舗1件までです。")
        else:
            if not existing_common.exists():
                form.add_error('quest_type', "共通チャレンジを先に1件作成してください。")
        if form.errors:
            return render(request, 'owner/create_challenge.html', {
                'form': form,
                'store': store,
                'coupons': coupons,
                'challenge_limit': challenge_limit,
                'current_challenges': current_challenges,
                'limit_reached': limit_reached,
            })
        if challenge.quest_type == 'common':
            challenge.reward_points = 20
            challenge.reward_type = 'points'
            challenge.reward_coupon = None
        else:
            challenge.reward_points = 0
            if challenge.reward_type != 'coupon':
                challenge.reward_coupon = None
        if not challenge.qr_code:
            challenge.qr_code = _generate_unique_qr_code()
        challenge.save()
        return redirect('create_challenge_success')

    return render(request, 'owner/create_challenge.html', {
        'form': form,
        'store': store,
        'coupons': coupons,
        'challenge_limit': challenge_limit,
        'current_challenges': current_challenges,
        'limit_reached': limit_reached,
    })

def create_challenge_success(request):
    store = _get_owner_store(request)
    if not store:
        return redirect("owner_dashboard")
    return render(request, 'owner/create_challenge_success.html', {'store': store})


def create_coupon(request):
    store = _get_owner_store(request)
    if not store:
        messages.error(request, "店舗情報が見つかりません。先に店舗登録を完了してください。")
        return redirect("owner_dashboard")

    coupon_limit = 10
    current_coupons = Coupon.objects.filter(store=store).count()
    coupon_limit_reached = current_coupons >= coupon_limit

    if request.method == 'POST':
        if coupon_limit_reached:
            messages.error(request, f"クーポンは最大{coupon_limit}件まで登録できます。既存のクーポンを削除してください。")
            return redirect('coupon_list')
        form = CouponForm(request.POST)
        if form.is_valid():
            coupon = form.save(commit=False)
            coupon.type = 'store_specific'
            coupon.store = store
            coupon.save()
            return redirect('create_coupon_success')
    else:
        form = CouponForm()

    return render(request, 'owner/create_coupon.html', {
        'form': form,
        'store': store,
        'coupon_limit': coupon_limit,
        'current_coupons': current_coupons,
        'coupon_limit_reached': coupon_limit_reached,
    })


def create_coupon_success(request):
    store = _get_owner_store(request)
    if not store:
        return redirect("owner_dashboard")
    return render(request, 'owner/create_coupon_success.html', {'store': store})


def my_challenges(request):
    store = _get_owner_store(request)
    if not store:
        messages.error(request, "店舗情報が見つかりません。先に店舗登録を完了してください。")
        return redirect("owner_dashboard")

    challenges = (Challenge.objects
                  .filter(store=store)
                  .select_related('reward_coupon')
                  .order_by('-created_at'))

    return render(request, 'owner/my_challenges.html', {
        'store': store,
        'challenges': challenges,
    })


def coupon_list(request):
    store = _get_owner_store(request)
    if not store:
        messages.error(request, "店舗情報が見つかりません。先に店舗登録を完了してください。")
        return redirect("owner_dashboard")

    coupons = (Coupon.objects
               .filter(store=store)
               .order_by('-expires_at', '-coupon_id'))

    return render(request, 'owner/coupons.html', {
        'store': store,
        'coupons': coupons,
    })


def stamp_settings(request):
    store = _get_owner_store(request)
    if not store:
        messages.error(request, "店舗情報が見つかりません。先に店舗登録を完了させてください。")
        return redirect("owner_dashboard")

    coupons = list(Coupon.objects.filter(store=store))
    setting = StoreStampSetting.objects.filter(store=store).first()
    events = (
        list(setting.rewards.select_related("reward_coupon").order_by("stamp_threshold"))
        if setting
        else []
    )
    max_stamps_value = setting.max_stamps if setting else 30

    if request.method == "POST" and request.POST.get("intent") == "update_card":
        max_input = request.POST.get("max_stamps")
        try:
            max_value = int(max_input)
        except (TypeError, ValueError):
            messages.error(request, "スタンプ数は1〜30の整数で入力してください。")
            return redirect("stamp_settings")
        if max_value < 1 or max_value > 30:
            messages.error(request, "スタンプ数は1〜30の範囲で入力してください。")
            return redirect("stamp_settings")
        if events:
            current_max_event = max(event.stamp_threshold for event in events)
            if max_value < current_max_event:
                messages.error(
                    request,
                    f"登録済みイベント（スタンプ{current_max_event}個）より小さい値は設定できません。"
                )
                return redirect("stamp_settings")
        if not setting:
            setting = StoreStampSetting.objects.create(store=store, max_stamps=max_value)
            messages.success(request, "スタンプカードを作成しました。イベントを追加してください。")
        else:
            setting.max_stamps = max_value
            setting.save()
            messages.success(request, "スタンプカード設定を更新しました。")
        return redirect("stamp_settings")

    return render(request, 'owner/stamp_settings.html', {
        'store': store,
        'setting': setting,
        'events': events,
        'max_stamps': max_stamps_value,
        'can_create_event': setting is not None,
    })


def edit_coupon(request, coupon_id):
    store = _get_owner_store(request)
    if not store:
        messages.error(request, "店舗情報が見つかりません。")
        return redirect("owner_dashboard")

    coupon = get_object_or_404(Coupon, pk=coupon_id, store=store)

    if request.method == 'POST':
        form = CouponForm(request.POST, instance=coupon)
        if form.is_valid():
            coupon = form.save(commit=False)
            coupon.store = store
            coupon.type = 'store_specific'
            coupon.save()
            messages.success(request, "クーポンを更新しました。")
            return redirect('coupon_list')
    else:
        form = CouponForm(instance=coupon)

    return render(request, 'owner/edit_coupon.html', {
        'store': store,
        'form': form,
        'coupon': coupon,
    })


@require_POST
def delete_coupon(request, coupon_id):
    store = _get_owner_store(request)
    if not store:
        messages.error(request, "店舗情報が見つかりません。")
        return redirect("owner_dashboard")

    coupon = get_object_or_404(Coupon, pk=coupon_id, store=store)
    coupon.delete()
    messages.success(request, "クーポンを削除しました。")
    return redirect('coupon_list')


def edit_challenge(request, challenge_id):
    store = _get_owner_store(request)
    if not store:
        messages.error(request, "店舗情報が見つかりません。先に店舗登録を完了してください。")
        return redirect("owner_dashboard")

    challenge = get_object_or_404(Challenge, pk=challenge_id, store=store)
    if challenge.quest_type == 'common':
        has_other_common = Challenge.objects.filter(
            store=store,
            quest_type='common',
        ).exclude(pk=challenge.challenge_id).exists()
        if not has_other_common:
            messages.error(request, "共通チャレンジは必ず1件必要です。")
            return redirect('my_challenges')

    if request.method == 'POST':
        form = ChallengeForm(request.POST, instance=challenge)
    else:
        form = ChallengeForm(instance=challenge)

    coupons = Coupon.objects.filter(store=store)
    if 'reward_coupon' in form.fields:
        form.fields['reward_coupon'].queryset = coupons
        form.fields['reward_coupon'].empty_label = "クーポンを選択"

    if request.method == 'POST' and form.is_valid():
        original_quest_type = challenge.quest_type
        challenge = form.save(commit=False)
        challenge.store = store
        # Enforce: exactly one common challenge per store.
        other_common = Challenge.objects.filter(store=store, quest_type='common').exclude(pk=challenge.challenge_id)
        if challenge.quest_type == 'common':
            if other_common.exists():
                form.add_error('quest_type', "共通チャレンジは1店舗1件までです。")
        else:
            if original_quest_type == 'common' and not other_common.exists():
                form.add_error('quest_type', "共通チャレンジは必ず1件必要です。")
            elif original_quest_type != 'common' and not other_common.exists():
                form.add_error('quest_type', "共通チャレンジを先に1件作成してください。")
        if form.errors:
            return render(request, 'owner/edit_challenge.html', {
                'store': store,
                'form': form,
                'challenge': challenge,
            })
        if challenge.quest_type == 'common':
            challenge.reward_points = 20
            challenge.reward_type = 'points'
            challenge.reward_coupon = None
        else:
            challenge.reward_points = 0
            if challenge.reward_type != 'coupon':
                challenge.reward_coupon = None
        if not challenge.qr_code:
            challenge.qr_code = _generate_unique_qr_code()
        challenge.save()
        messages.success(request, "チャレンジを更新しました。")
        return redirect('my_challenges')

    return render(request, 'owner/edit_challenge.html', {
        'store': store,
        'form': form,
        'challenge': challenge,
    })


@require_POST
def delete_challenge(request, challenge_id):
    store = _get_owner_store(request)
    if not store:
        messages.error(request, "店舗情報が見つかりません。")
        return redirect("owner_dashboard")

    challenge = get_object_or_404(Challenge, pk=challenge_id, store=store)
    challenge.delete()
    messages.success(request, "チャレンジを削除しました。")
    return redirect('my_challenges')

@require_POST
def delete_stamp_settings(request):
    store = _get_owner_store(request)
    if not store:
        messages.error(request, "店舗情報が見つかりません。先に店舗登録を完了させてください。")
        return redirect("owner_dashboard")

    messages.error(request, "スタンプカードは作成後に削除できません。")
    return redirect("stamp_settings")

def create_stamp_event(request):
    store = _get_owner_store(request)
    if not store:
        messages.error(request, "店舗情報が見つかりません。先に店舗登録を完了させてください。")
        return redirect("owner_dashboard")

    setting = StoreStampSetting.objects.filter(store=store).first()
    if not setting:
        messages.error(request, "先にスタンプカードを作成してください。")
        return redirect("stamp_settings")

    coupons = Coupon.objects.filter(store=store)
    if request.method == "POST":
        form = StampEventForm(
            request.POST,
            coupon_queryset=coupons,
            max_stamps=setting.max_stamps,
        )
        if form.is_valid():
            threshold = form.cleaned_data["stamp_threshold"]
            if setting.rewards.filter(stamp_threshold=threshold).exists():
                form.add_error("stamp_threshold", "同じスタンプ数のイベントがすでに登録されています。")
            else:
                reward = StoreStampReward(
                    setting=setting,
                    stamp_threshold=threshold,
                    reward_type=form.cleaned_data["reward_type"],
                    reward_coupon=form.cleaned_data["reward_coupon"] if form.cleaned_data["reward_type"] == "coupon" else None,
                    reward_service_desc=form.cleaned_data["reward_service_desc"] if form.cleaned_data["reward_type"] == "service" else "",
                    display_order=setting.rewards.count(),
                )
                reward.save()
                messages.success(request, "スタンプイベントを追加しました。")
                return redirect("stamp_settings")
    else:
        form = StampEventForm(coupon_queryset=coupons, max_stamps=setting.max_stamps)

    return render(request, "owner/stamp_event_form.html", {
        "store": store,
        "form": form,
        "setting": setting,
        "mode": "create",
    })


def edit_stamp_event(request, event_id):
    store = _get_owner_store(request)
    if not store:
        messages.error(request, "店舗情報が見つかりません。先に店舗登録を完了させてください。")
        return redirect("owner_dashboard")

    reward = get_object_or_404(StoreStampReward, pk=event_id, setting__store=store)
    setting = reward.setting
    coupons = Coupon.objects.filter(store=store)

    if request.method == "POST":
        form = StampEventForm(
            request.POST,
            coupon_queryset=coupons,
            max_stamps=setting.max_stamps,
        )
        if form.is_valid():
            threshold = form.cleaned_data["stamp_threshold"]
            exists = setting.rewards.exclude(pk=reward.pk).filter(stamp_threshold=threshold).exists()
            if exists:
                form.add_error("stamp_threshold", "同じスタンプ数のイベントがすでに登録されています。")
            else:
                reward.stamp_threshold = threshold
                reward.reward_type = form.cleaned_data["reward_type"]
                if reward.reward_type == "coupon":
                    reward.reward_coupon = form.cleaned_data["reward_coupon"]
                    reward.reward_service_desc = ""
                else:
                    reward.reward_coupon = None
                    reward.reward_service_desc = form.cleaned_data["reward_service_desc"]
                reward.save()
                messages.success(request, "スタンプイベントを更新しました。")
                return redirect("stamp_settings")
    else:
        initial = {
            "stamp_threshold": reward.stamp_threshold,
            "reward_type": reward.reward_type,
            "reward_coupon": reward.reward_coupon_id,
            "reward_service_desc": reward.reward_service_desc,
        }
        form = StampEventForm(
            initial=initial,
            coupon_queryset=coupons,
            max_stamps=setting.max_stamps,
        )

    return render(request, "owner/stamp_event_form.html", {
        "store": store,
        "form": form,
        "setting": setting,
        "mode": "edit",
        "event": reward,
    })


@require_POST
def delete_stamp_event(request, event_id):
    store = _get_owner_store(request)
    if not store:
        messages.error(request, "店舗情報が見つかりません。先に店舗登録を完了させてください。")
        return redirect("owner_dashboard")

    reward = get_object_or_404(StoreStampReward, pk=event_id, setting__store=store)
    reward.delete()
    messages.success(request, "スタンプイベントを削除しました。")
    return redirect("stamp_settings")

def stats(request):
    store = _get_owner_store(request)
    if not store:
        messages.error(request, "店舗情報が見つかりません。先に店舗登録を完了させてください。")
        return redirect("owner_dashboard")

    total_attempts = UserChallenge.objects.filter(challenge__store=store).count()
    cleared_qs = UserChallenge.objects.filter(challenge__store=store, status="cleared")
    cleared_count = cleared_qs.count()
    total_participants = cleared_qs.values("user_id").distinct().count()
    clear_rate = round((cleared_count / total_attempts) * 100, 1) if total_attempts else 0

    total_stamps = (
        StoreStamp.objects.filter(store=store).aggregate(total=Sum("stamps_count")).get("total") or 0
    )
    if total_stamps == 0:
        total_stamps = StoreStampHistory.objects.filter(store=store).count()

    coupon_usage = StoreCouponUsageHistory.objects.filter(store=store).count()

    ranking_qs = (
        cleared_qs.values("challenge__title")
        .annotate(count=Count("pk"))
        .order_by("-count", "challenge__title")[:5]
    )
    ranking = [f"{item['challenge__title']}（{item['count']}件）" for item in ranking_qs]

    today = timezone.localdate()
    days = 14
    start_date = today - datetime.timedelta(days=days - 1)
    history_qs = (
        StoreStampHistory.objects.filter(store=store, stamp_date__range=(start_date, today))
        .values("stamp_date")
        .annotate(count=Count("pk"))
    )
    history_map = {item["stamp_date"]: item["count"] for item in history_qs}
    chart_labels = []
    chart_values = []
    for i in range(days):
        current = start_date + datetime.timedelta(days=i)
        chart_labels.append(current.strftime("%m/%d"))
        chart_values.append(history_map.get(current, 0))

    overview = {
        "total_participants": total_participants,
        "clear_rate": clear_rate,
        "total_stamps": total_stamps,
        "coupon_usage": coupon_usage,
    }

    return render(request, "owner/stats.html", {
        "store": store,
        "overview": overview,
        "ranking": ranking,
        "chart_labels": chart_labels,
        "chart_values": chart_values,
    })


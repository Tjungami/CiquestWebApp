# C:\Users\j_tagami\CiquestWebApp\owner\views.py
import uuid

from django.shortcuts import render, get_object_or_404, redirect
from django.db import transaction
from django.utils import timezone
from django.utils.safestring import mark_safe
from ciquest_model.models import (
    Store,
    StoreOwner,
    Challenge,
    Coupon,
    Notice,
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



def login_view(request):
    return redirect('login')

def dashboard(request):
    """オーナーダッシュボード"""
    owner_id = request.session.get("owner_id")
    if not owner_id:
        return redirect("login")

    owner = get_object_or_404(StoreOwner, pk=owner_id)
    stores = Store.objects.filter(owner=owner).order_by("-created_at")
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

    if request.method == "POST":
        application_form = StoreApplicationForm(request.POST)
        if application_form.is_valid():
            new_store = application_form.save(commit=False)
            new_store.owner = owner
            new_store.status = "pending"
            new_store.qr_code = _generate_unique_store_qr_code()
            new_store.save()
            messages.success(request, "店舗申請を受け付けました。審査結果をお待ちください。")
            return redirect("owner_dashboard")
        messages.error(request, f"Store application failed: {application_form.errors}")
    else:
        application_form = StoreApplicationForm()

    return render(
        request,
        "owner/dashboard.html",
        {
            "owner": owner,
            "stores": stores,
            "application_form": application_form,
            "notices": notices,
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
        if challenge.quest_type == 'common':
            challenge.reward_points = 20
            challenge.reward_type = 'points'
            challenge.reward_coupon = None
        else:
            if not challenge.reward_points:
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

    if request.method == 'POST':
        form = ChallengeForm(request.POST, instance=challenge)
    else:
        form = ChallengeForm(instance=challenge)

    coupons = Coupon.objects.filter(store=store)
    if 'reward_coupon' in form.fields:
        form.fields['reward_coupon'].queryset = coupons
        form.fields['reward_coupon'].empty_label = "クーポンを選択"

    if request.method == 'POST' and form.is_valid():
        challenge = form.save(commit=False)
        challenge.store = store
        if challenge.quest_type == 'common':
            challenge.reward_points = 20
            challenge.reward_type = 'points'
            challenge.reward_coupon = None
        else:
            if not challenge.reward_points:
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

    setting = StoreStampSetting.objects.filter(store=store).first()
    if not setting:
        messages.info(request, "削除できるスタンプカードはありません。")
        return redirect("stamp_settings")

    setting.delete()
    messages.success(request, "スタンプカードを削除しました。必要に応じて新しく作成してください。")
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

    overview = {
        "total_participants": 0,
        "clear_rate": 0,
        "total_stamps": 0,
        "coupon_usage": 0,
    }
    ranking = []
    chart_labels = []
    chart_values = []

    return render(request, "owner/stats.html", {
        "store": store,
        "overview": overview,
        "ranking": ranking,
        "chart_labels": chart_labels,
        "chart_values": chart_values,
    })


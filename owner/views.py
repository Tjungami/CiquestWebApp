# C:\Users\j_tagami\CiquestWebApp\owner\views.py
from django.shortcuts import render, get_object_or_404, redirect
from ciquest_model.models import Store, StoreOwner, Challenge, Coupon
from django.contrib.auth import logout
from django.contrib import messages
from .forms import ChallengeForm, CouponForm


def _get_owner_store(request):
    owner_id = request.session.get("owner_id")
    user = getattr(request, "user", None)
    if not owner_id and getattr(user, "is_authenticated", False):
        owner_id = user.id
    if not owner_id:
        return None
    return Store.objects.filter(owner_id=owner_id).first()



def login_view(request):
    """店舗オーナーログイン処理"""
    if request.method == "POST":
        email = request.POST.get("email")
        password = request.POST.get("password")

        try:
            owner = StoreOwner.objects.get(email=email)
            if owner.password == password and owner.approved:
                request.session["owner_id"] = owner.owner_id
                return redirect("owner_dashboard")
            else:
                return render(request, "owner/login.html", {"error": "認証に失敗しました。"})
        except StoreOwner.DoesNotExist:
            return render(request, "owner/login.html", {"error": "登録されていないメールアドレスです。"})
    return render(request, "owner/login.html")


def dashboard(request):
    """オーナーダッシュボード"""
    owner_id = request.session.get("owner_id")
    if not owner_id:
        return redirect("login")

    owner = get_object_or_404(StoreOwner, pk=owner_id)
    stores = Store.objects.filter(owner=owner)
    return render(request, "owner/dashboard.html", {"owner": owner, "stores": stores})


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

    coupons = Coupon.objects.filter(store=store)

    if request.method == 'POST':
        form = ChallengeForm(request.POST)
        if form.is_valid():
            challenge = form.save(commit=False)
            challenge.store = store
            if challenge.quest_type == 'common':
                challenge.reward_points = 20
            challenge.save()
            return redirect('create_challenge_success')
    else:
        form = ChallengeForm()

    return render(request, 'owner/create_challenge.html', {
        'form': form,
        'store': store,
        'coupons': coupons,
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

    if request.method == 'POST':
        form = CouponForm(request.POST)
        if form.is_valid():
            coupon = form.save(commit=False)
            if coupon.type == 'store_specific':
                coupon.store = store
            else:
                coupon.store = None
            coupon.save()
            return redirect('create_coupon_success')
    else:
        form = CouponForm()

    return render(request, 'owner/create_coupon.html', {
        'form': form,
        'store': store,
    })


def create_coupon_success(request):
    store = _get_owner_store(request)
    if not store:
        return redirect("owner_dashboard")
    return render(request, 'owner/create_coupon_success.html', {'store': store})

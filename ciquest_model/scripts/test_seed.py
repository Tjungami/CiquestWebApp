# -*- coding: utf-8 -*-
from __future__ import unicode_literals
from ciquest_model.models import *
from django.utils import timezone



# 既存データをクリア（安全な開発環境限定）
def reset_all():
    UserChallenge.objects.all().delete()
    UserCoupon.objects.all().delete()
    StoreStamp.objects.all().delete()
    StoreTag.objects.all().delete()
    Challenge.objects.all().delete()
    Coupon.objects.all().delete()
    Store.objects.all().delete()
    StoreOwner.objects.all().delete()
    User.objects.all().delete()
    Rank.objects.all().delete()
    Tag.objects.all().delete()
    print("全テーブルを初期化しました。")


def seed_ranks():
    ranks = [
        ("ビギナー", 0, 3),
        ("アドベンチャラー", 100, 5),
        ("マスター", 500, 8),
    ]
    for name, req_pts, max_ch in ranks:
        Rank.objects.create(name=name, required_points=req_pts, max_challenges_per_day=max_ch)
    print("ランクを作成しました。")


def seed_users():
    ranks = list(Rank.objects.all())
    users = [
        ("taro", "taro@example.com", "hashed_pw_1", ranks[0]),
        ("hanako", "hanako@example.com", "hashed_pw_2", ranks[1]),
        ("jiro", "jiro@example.com", "hashed_pw_3", ranks[0]),
    ]
    for username, email, pw, rank in users:
        User.objects.create(username=username, email=email, password=pw, rank=rank, points=50)
    print("ユーザーを作成しました。")


def seed_store_owners():
    owners = [
        ("佐藤商店", "sato@store.com", "hashed_store_pw_1", True),
        ("田中屋", "tanaka@store.com", "hashed_store_pw_2", True),
        ("未承認オーナー", "test@pending.com", "hashed_pw_3", False),
    ]
    for name, email, pw, approved in owners:
        StoreOwner.objects.create(name=name, email=email, password=pw, approved=approved)
    print("店舗オーナーを作成しました。")


def seed_stores():
    owners = list(StoreOwner.objects.filter(approved=True))
    stores = [
        (owners[0], "佐藤商店", "宇都宮市中央1-1-1", 36.5551234, 139.8823456, "10:00〜19:00", "地元に愛される商店", "QR001", "approved"),
        (owners[1], "田中屋カフェ", "宇都宮市泉町2-5", 36.5607890, 139.8801234, "9:00〜18:00", "落ち着いた雰囲気のカフェ", "QR002", "approved"),
    ]
    for o, n, a, lat, lng, bh, desc, qr, st in stores:
        Store.objects.create(owner=o, name=n, address=a, latitude=lat, longitude=lng,
                             business_hours=bh, store_description=desc, qr_code=qr, status=st)
    print("店舗を作成しました。")


def seed_coupons():
    stores = list(Store.objects.all())
    coupons = [
        (stores[0], "100円引きクーポン", "お会計時に使用可能", 100, "store_specific"),
        (stores[1], "ドリンク無料クーポン", "1ドリンク無料", 150, "store_specific"),
        (None, "共通割引券", "全店舗で利用可", 200, "common"),
    ]
    for s, t, d, req, typ in coupons:
        Coupon.objects.create(store=s, title=t, description=d, required_points=req, type=typ)
    print("クーポンを作成しました。")


def seed_challenges():
    stores = list(Store.objects.all())
    coupons = list(Coupon.objects.all())
    challenges = [
        (stores[0], "初回購入チャレンジ", "佐藤商店で買い物をする", 50, "PURCHASE", "store_specific", "points", None, "QR001"),
        (stores[1], "写真投稿チャレンジ", "田中屋カフェで写真を撮って投稿", 70, "PHOTO", "store_specific", "coupon", coupons[1], "QR002"),
        (stores[0], "来店チェックイン", "来店してQRをスキャン", 30, "VISIT", "common", "points", None, "QR003"),
    ]
    for s, t, d, rp, ty, qt, rt, rc, qr in challenges:
        Challenge.objects.create(store=s, title=t, description=d, reward_points=rp,
                                 type=ty, quest_type=qt, reward_type=rt,
                                 reward_coupon=rc, qr_code=qr)
    print("チャレンジを作成しました。")


def seed_user_challenges():
    users = list(User.objects.all())
    challenges = list(Challenge.objects.all())
    UserChallenge.objects.create(user=users[0], challenge=challenges[0], status="cleared", approved_by_store=True)
    UserChallenge.objects.create(user=users[1], challenge=challenges[1])
    UserChallenge.objects.create(user=users[2], challenge=challenges[2])
    print("チャレンジ進捗を作成しました。")


def seed_tags():
    tags = [
        ("グルメ", "カテゴリ", 1),
        ("雑貨", "カテゴリ", 2),
        ("観光", "カテゴリ", 3),
    ]
    for name, cat, order in tags:
        Tag.objects.create(name=name, category=cat, display_order=order)
    print("タグを作成しました。")


def seed_store_tags():
    stores = list(Store.objects.all())
    tags = list(Tag.objects.all())
    owners = list(StoreOwner.objects.all())
    StoreTag.objects.create(store=stores[0], tag=tags[0], added_by=owners[0])
    StoreTag.objects.create(store=stores[1], tag=tags[1], added_by=owners[1])
    print("店舗タグを作成しました。")


def seed_store_stamps():
    users = list(User.objects.all())
    stores = list(Store.objects.all())
    StoreStamp.objects.create(user=users[0], store=stores[0], stamps_count=3)
    StoreStamp.objects.create(user=users[1], store=stores[1], stamps_count=1)
    print("スタンプカードを作成しました。")


def seed_user_coupons():
    users = list(User.objects.all())
    coupons = list(Coupon.objects.all())
    UserCoupon.objects.create(user=users[0], coupon=coupons[0], is_used=False)
    UserCoupon.objects.create(user=users[1], coupon=coupons[2], is_used=True, used_at=timezone.now())
    print("ユーザー所持クーポンを作成しました。")


if __name__ == "__main__":
    reset_all()
    seed_ranks()
    seed_users()
    seed_store_owners()
    seed_stores()
    seed_coupons()
    seed_challenges()
    seed_user_challenges()
    seed_tags()
    seed_store_tags()
    seed_store_stamps()
    seed_user_coupons()
    print("テストデータ投入完了！")

def run():
    reset_all()
    seed_ranks()
    seed_users()
    seed_store_owners()
    seed_stores()
    seed_coupons()
    seed_challenges()
    seed_user_challenges()
    seed_tags()
    seed_store_tags()
    seed_store_stamps()
    seed_user_coupons()
    print("テストデータ投入完了！")

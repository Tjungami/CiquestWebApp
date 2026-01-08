# ciquest_model/management/commands/seed_ciquest.py
from django.core.management.base import BaseCommand
from django.utils import timezone
from decimal import Decimal
from datetime import timedelta

from ciquest_model.models import (
    Rank, User, StoreOwner, Store, Tag, StoreTag,
    Coupon, Challenge, UserChallenge, UserCoupon,
    StoreStampSetting, StoreStampReward, StoreStamp,
    AdminAccount, AdminInquiry
)

class Command(BaseCommand):
    help = "Seed test data for Ciquest"

    def handle(self, *args, **options):
        # 既存データが空前提（さっきTRUNCATEした状態）でもOK
        # もし残ってる可能性があるなら、ここでdeleteしてもいい

        # ---- Rank ----
        ranks = [
            Rank(name="ブロンズ", required_points=0,   max_challenges_per_day=3),
            Rank(name="シルバー", required_points=50,  max_challenges_per_day=5),
            Rank(name="ゴールド", required_points=150, max_challenges_per_day=8),
        ]
        Rank.objects.bulk_create(ranks)
        bronze = Rank.objects.get(name="ブロンズ")
        silver = Rank.objects.get(name="シルバー")
        gold = Rank.objects.get(name="ゴールド")

        # ---- Users ----
        # passwordは save() 内でハッシュ化される
        u1 = User(username="jun",   email="jun@example.com",   password="password123", rank=bronze, points=10)
        u2 = User(username="yuki",  email="yuki@example.com",  password="password123", rank=silver, points=70)
        u3 = User(username="taro",  email="taro@example.com",  password="password123", rank=gold,   points=210)
        u1.save(); u2.save(); u3.save()

        # ---- StoreOwners ----
        o1 = StoreOwner(
            name="田上商店 代表", business_name="田上商店", contact_phone="080-1111-2222",
            email="owner1@example.com", password="ownerpass",
            approved=True, is_verified=True, onboarding_completed=True
        )
        o2 = StoreOwner(
            name="宇都宮カフェ 管理者", business_name="Utsunomiya Cafe", contact_phone="090-3333-4444",
            email="owner2@example.com", password="ownerpass",
            approved=True, is_verified=True, onboarding_completed=True
        )
        o1.save(); o2.save()

        # ---- Stores ----
        # 緯度経度は Decimal 推奨
        s1 = Store(
            owner=o1, name="餃子のタガミ", address="栃木県宇都宮市○○1-2-3",
            latitude=Decimal("36.5551000"), longitude=Decimal("139.8825000"),
            business_hours="11:00-20:00",
            business_hours_json={"mon":["11:00","20:00"],"tue":["11:00","20:00"],"wed":["11:00","20:00"],"thu":["11:00","20:00"],"fri":["11:00","21:00"],"sat":["11:00","21:00"],"sun":["11:00","20:00"]},
            store_description="宇都宮の定番餃子。焼き・水餃子どっちも。",
            phone="028-000-0001",
            website="https://example.com/gyoza",
            instagram="https://instagram.com/example_gyoza",
            main_image="stores/gyoza_tagami_main.jpg",
            qr_code="STORE_QR_GYOZA_TAGAMI_0001",
            status="approved",
            is_featured=True,
            priority=10,
        )
        s2 = Store(
            owner=o2, name="ミルクフォーム研究所", address="栃木県宇都宮市△△4-5-6",
            latitude=Decimal("36.5602000"), longitude=Decimal("139.8801000"),
            business_hours="10:00-18:00",
            business_hours_json={"mon":["10:00","18:00"],"tue":["10:00","18:00"],"wed":["10:00","18:00"],"thu":["10:00","18:00"],"fri":["10:00","18:00"],"sat":["10:00","19:00"],"sun":["10:00","19:00"]},
            store_description="抹茶ラテとフォームにこだわるカフェ。",
            phone="028-000-0002",
            website="https://example.com/latte",
            instagram="https://instagram.com/example_latte",
            main_image="stores/milkfoam_lab_main.jpg",
            qr_code="STORE_QR_MILKFOAM_LAB_0002",
            status="approved",
            is_featured=False,
            priority=5,
        )
        s1.save(); s2.save()

        # ---- Tags ----
        t_food = Tag.objects.create(name="グルメ", category="ジャンル", display_order=1, is_active=True)
        t_cafe = Tag.objects.create(name="カフェ", category="ジャンル", display_order=2, is_active=True)
        t_family = Tag.objects.create(name="家族向け", category="属性", display_order=10, is_active=True)
        t_takeout = Tag.objects.create(name="テイクアウト", category="属性", display_order=11, is_active=True)

        # ---- StoreTag (unique_together) ----
        StoreTag.objects.create(store=s1, tag=t_food, added_by=o1)
        StoreTag.objects.create(store=s1, tag=t_takeout, added_by=o1)
        StoreTag.objects.create(store=s2, tag=t_cafe, added_by=o2)
        StoreTag.objects.create(store=s2, tag=t_family, added_by=o2)

        # ---- Coupons ----
        now = timezone.now()
        c_common = Coupon.objects.create(
            store=None, title="共通：100円引き", description="全対象店舗で使える割引",
            required_points=30, type="common", expires_at=now + timedelta(days=60), publish_to_shop=True
        )
        c_s1 = Coupon.objects.create(
            store=s1, title="餃子 1皿サービス", description="来店時に餃子1皿サービス",
            required_points=60, type="store_specific", expires_at=now + timedelta(days=30), publish_to_shop=True
        )
        c_s2 = Coupon.objects.create(
            store=s2, title="ラテ トッピング無料", description="フォーム増量 or シロップ追加",
            required_points=40, type="store_specific", expires_at=now + timedelta(days=45), publish_to_shop=True
        )

        # ---- Challenges ----
        ch1 = Challenge.objects.create(
            store=s1, title="餃子を購入してポイントGET", description="会計後にQRを読み取り",
            reward_points=15, type="PURCHASE", quest_type="store_specific",
            reward_type="points", qr_code="CH_QR_GYOZA_BUY_0001"
        )
        ch2 = Challenge.objects.create(
            store=s2, title="抹茶ラテの写真投稿", description="フォームが分かる写真で投稿",
            reward_points=20, type="PHOTO", quest_type="store_specific",
            reward_type="coupon", reward_coupon=c_s2, qr_code="CH_QR_LATTE_PHOTO_0002"
        )
        ch3 = Challenge.objects.create(
            store=s1, title="来店スタンプ", description="来店してスタンプ+1",
            reward_points=5, type="VISIT", quest_type="store_specific",
            reward_type="points", qr_code="CH_QR_GYOZA_VISIT_0003"
        )

        # ---- UserChallenge ----
        UserChallenge.objects.create(user=u1, challenge=ch1, status="in_progress")
        UserChallenge.objects.create(user=u2, challenge=ch2, status="cleared", cleared_at=now - timedelta(days=1), approved_by_store=True)
        UserChallenge.objects.create(user=u3, challenge=ch3, status="retired")

        # ---- UserCoupon ----
        UserCoupon.objects.create(user=u2, coupon=c_s2, is_used=False)
        UserCoupon.objects.create(user=u3, coupon=c_common, is_used=True, used_at=now - timedelta(days=3))

        # ---- Stamp setting / reward / stamp ----
        setting1 = StoreStampSetting.objects.create(store=s1, max_stamps=10)
        StoreStampReward.objects.create(
            setting=setting1, stamp_threshold=5, reward_type="service",
            reward_service_desc="餃子トッピング（ねぎ）無料", display_order=1
        )
        StoreStampReward.objects.create(
            setting=setting1, stamp_threshold=10, reward_type="coupon",
            reward_coupon=c_s1, display_order=2
        )
        StoreStamp.objects.create(user=u1, store=s1, stamps_count=3, reward_given=False)
        StoreStamp.objects.create(user=u2, store=s1, stamps_count=6, reward_given=False)

        # ---- AdminAccount ----
        a1 = AdminAccount(name="管理者A", email="admin@example.com", password="adminpass", approval_status="approved", is_active=True)
        a1.save()

        # ---- AdminInquiry ----
        AdminInquiry.objects.create(
            store=s1, related_challenge=ch1, category="審査",
            message="チャレンジの証跡画像が見えづらいので確認したい",
            status="unread"
        )

        self.stdout.write(self.style.SUCCESS("Seed completed."))

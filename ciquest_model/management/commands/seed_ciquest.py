from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from ciquest_model.models import (
    AdminAccount,
    AdminInquiry,
    Challenge,
    Coupon,
    Rank,
    Store,
    StoreOwner,
    StoreStamp,
    StoreStampReward,
    StoreStampSetting,
    StoreTag,
    Tag,
    User,
    UserChallenge,
    UserCoupon,
)


class Command(BaseCommand):
    help = "Seed test data for Ciquest"

    def handle(self, *args, **options):
        # This assumes the database has been cleared.

        # ---- Rank ----
        Rank.objects.bulk_create(
            [
                Rank(name="ブロンズ", required_points=0, max_challenges_per_day=3),
                Rank(name="シルバー", required_points=50, max_challenges_per_day=5),
                Rank(name="ゴールド", required_points=150, max_challenges_per_day=8),
            ]
        )
        bronze = Rank.objects.get(name="ブロンズ")
        silver = Rank.objects.get(name="シルバー")
        gold = Rank.objects.get(name="ゴールド")

        # ---- Users ----
        u1 = User(username="jun", email="jun@example.com", password="password123", rank=bronze, points=10)
        u2 = User(username="yuki", email="yuki@example.com", password="password123", rank=silver, points=70)
        u3 = User(username="taro", email="taro@example.com", password="password123", rank=gold, points=210)
        u1.save()
        u2.save()
        u3.save()

        # ---- StoreOwners ----
        o1 = StoreOwner(
            name="田上商店 代表",
            business_name="田上商店",
            contact_phone="080-1111-2222",
            email="owner1@example.com",
            password="ownerpass",
            approved=True,
            is_verified=True,
            onboarding_completed=True,
        )
        o2 = StoreOwner(
            name="宇都宮カフェ 管理者",
            business_name="Utsunomiya Cafe",
            contact_phone="090-3333-4444",
            email="owner2@example.com",
            password="ownerpass",
            approved=True,
            is_verified=True,
            onboarding_completed=True,
        )
        o1.save()
        o2.save()

        # ---- Stores ----
        s1 = Store(
            owner=o1,
            name="餃子タガミ",
            address="栃木県宇都宮市1-2-3",
            latitude=Decimal("36.5551000"),
            longitude=Decimal("139.8825000"),
            business_hours="11:00-20:00",
            business_hours_json={
                "mon": ["11:00", "20:00"],
                "tue": ["11:00", "20:00"],
                "wed": ["11:00", "20:00"],
                "thu": ["11:00", "20:00"],
                "fri": ["11:00", "21:00"],
                "sat": ["11:00", "21:00"],
                "sun": ["11:00", "20:00"],
            },
            store_description="宇都宮名物の餃子店。焼き餃子・水餃子どちらも人気。",
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
            owner=o2,
            name="ミルクフォーム研究所",
            address="栃木県宇都宮市4-5-6",
            latitude=Decimal("36.5602000"),
            longitude=Decimal("139.8801000"),
            business_hours="10:00-18:00",
            business_hours_json={
                "mon": ["10:00", "18:00"],
                "tue": ["10:00", "18:00"],
                "wed": ["10:00", "18:00"],
                "thu": ["10:00", "18:00"],
                "fri": ["10:00", "18:00"],
                "sat": ["10:00", "19:00"],
                "sun": ["10:00", "19:00"],
            },
            store_description="抹茶ラテのフォームにこだわるカフェ。",
            phone="028-000-0002",
            website="https://example.com/latte",
            instagram="https://instagram.com/example_latte",
            main_image="stores/milkfoam_lab_main.jpg",
            qr_code="STORE_QR_MILKFOAM_LAB_0002",
            status="approved",
            is_featured=False,
            priority=5,
        )
        s1.save()
        s2.save()

        # ---- Tags ----
        t_food = Tag.objects.create(name="グルメ", category="ジャンル", display_order=1, is_active=True)
        t_cafe = Tag.objects.create(name="カフェ", category="ジャンル", display_order=2, is_active=True)
        t_family = Tag.objects.create(name="家族向け", category="属性", display_order=10, is_active=True)
        t_takeout = Tag.objects.create(name="テイクアウト", category="属性", display_order=11, is_active=True)

        # ---- StoreTag ----
        StoreTag.objects.create(store=s1, tag=t_food, added_by=o1)
        StoreTag.objects.create(store=s1, tag=t_takeout, added_by=o1)
        StoreTag.objects.create(store=s2, tag=t_cafe, added_by=o2)
        StoreTag.objects.create(store=s2, tag=t_family, added_by=o2)

        # ---- Coupons ----
        now = timezone.now()
        c_common = Coupon.objects.create(
            store=None,
            title="共通100円引き",
            description="対象店舗ならどこでも使える割引。",
            required_points=30,
            type="common",
            expires_at=now + timedelta(days=60),
            publish_to_shop=True,
        )
        c_s1 = Coupon.objects.create(
            store=s1,
            title="餃子1皿サービス",
            description="来店時に餃子1皿サービス。",
            required_points=60,
            type="store_specific",
            expires_at=now + timedelta(days=30),
            publish_to_shop=True,
        )
        c_s2 = Coupon.objects.create(
            store=s2,
            title="ラテトッピング無料",
            description="フォーム増量またはシロップ追加。",
            required_points=40,
            type="store_specific",
            expires_at=now + timedelta(days=45),
            publish_to_shop=True,
        )

        # ---- Challenges ----
        ch1 = Challenge.objects.create(
            store=s1,
            title="餃子購入でポイント獲得",
            description="会計後にQRを読み取ってください。",
            reward_points=15,
            type="PURCHASE",
            quest_type="store_specific",
            reward_type="points",
            qr_code="CH_QR_GYOZA_BUY_0001",
        )
        ch2 = Challenge.objects.create(
            store=s2,
            title="抹茶ラテ写真投稿",
            description="フォームがわかる写真を投稿。",
            reward_points=20,
            type="PHOTO",
            quest_type="store_specific",
            reward_type="coupon",
            reward_coupon=c_s2,
            qr_code="CH_QR_LATTE_PHOTO_0002",
        )
        ch3 = Challenge.objects.create(
            store=s1,
            title="来店スタンプ",
            description="来店してスタンプ1つ。",
            reward_points=5,
            type="VISIT",
            quest_type="store_specific",
            reward_type="points",
            qr_code="CH_QR_GYOZA_VISIT_0003",
        )

        # ---- UserChallenge ----
        UserChallenge.objects.create(user=u1, challenge=ch1, status="in_progress")
        UserChallenge.objects.create(
            user=u2,
            challenge=ch2,
            status="cleared",
            cleared_at=now - timedelta(days=1),
            approved_by_store=True,
        )
        UserChallenge.objects.create(user=u3, challenge=ch3, status="retired")

        # ---- UserCoupon ----
        UserCoupon.objects.create(user=u2, coupon=c_s2, is_used=False)
        UserCoupon.objects.create(user=u3, coupon=c_common, is_used=True, used_at=now - timedelta(days=3))

        # ---- Stamp setting / reward / stamp ----
        setting1 = StoreStampSetting.objects.create(store=s1, max_stamps=10)
        StoreStampReward.objects.create(
            setting=setting1,
            stamp_threshold=5,
            reward_type="service",
            reward_service_desc="餃子トッピング（ねぎ）無料。",
            display_order=1,
        )
        StoreStampReward.objects.create(
            setting=setting1,
            stamp_threshold=10,
            reward_type="coupon",
            reward_coupon=c_s1,
            display_order=2,
        )
        StoreStamp.objects.create(user=u1, store=s1, stamps_count=3, reward_given=False)
        StoreStamp.objects.create(user=u2, store=s1, stamps_count=6, reward_given=False)

        # ---- AdminAccount ----
        a1 = AdminAccount(
            name="管理者",
            email="admin@example.com",
            password="adminpass",
            approval_status="approved",
            is_active=True,
        )
        a1.save()

        # ---- AdminInquiry ----
        AdminInquiry.objects.create(
            store=s1,
            related_challenge=ch1,
            category="審査",
            message="チャレンジの証跡画像が見えづらいため確認したい。",
            status="unread",
        )

        self.stdout.write(self.style.SUCCESS("Seed completed."))

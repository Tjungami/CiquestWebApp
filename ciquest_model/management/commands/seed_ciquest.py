from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
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
    help = "Seed test data for Ciquest (safe & idempotent)"

    @transaction.atomic
    def handle(self, *args, **options):
        now = timezone.now()

        # --------------------
        # Helpers
        # --------------------
        def upsert_rank(name, required_points, max_per_day):
            obj, _ = Rank.objects.update_or_create(
                name=name,
                defaults={"required_points": required_points, "max_challenges_per_day": max_per_day},
            )
            return obj

        def upsert_user(email, username, raw_password, rank, points):
            obj, created = User.objects.get_or_create(
                email=email,
                defaults={"username": username, "password": raw_password, "rank": rank, "points": points},
            )
            if not created:
                # update safe fields only (do NOT reset password on re-run)
                changed = False
                if obj.username != username:
                    obj.username = username
                    changed = True
                if obj.rank_id != (rank.rank_id if rank else None):
                    obj.rank = rank
                    changed = True
                if obj.points != points:
                    obj.points = points
                    changed = True
                if changed:
                    obj.save(update_fields=["username", "rank", "points"])
            return obj

        def upsert_owner(email, raw_password, **fields):
            obj, created = StoreOwner.objects.get_or_create(
                email=email,
                defaults={"password": raw_password, **fields},
            )
            if not created:
                # update safe fields only (do NOT reset password on re-run)
                changed_fields = []
                for k, v in fields.items():
                    if getattr(obj, k) != v:
                        setattr(obj, k, v)
                        changed_fields.append(k)
                if changed_fields:
                    obj.save(update_fields=changed_fields)
            return obj

        def upsert_admin(email, raw_password, **fields):
            obj, created = AdminAccount.objects.get_or_create(
                email=email,
                defaults={"password": raw_password, **fields},
            )
            if not created:
                changed_fields = []
                for k, v in fields.items():
                    if getattr(obj, k) != v:
                        setattr(obj, k, v)
                        changed_fields.append(k)
                if changed_fields:
                    obj.save(update_fields=changed_fields)
            return obj

        def upsert_coupon(store, title, *, create_only_expires_days=None, **fields):
            # store + title で一意とみなす（DB制約も付けるの推奨）
            obj, created = Coupon.objects.get_or_create(
                store=store,
                title=title,
                defaults={
                    **fields,
                    **(
                        {"expires_at": now + timedelta(days=create_only_expires_days)}
                        if create_only_expires_days is not None
                        else {}
                    ),
                },
            )
            if not created:
                # expires_at は作成時のみ。その他は必要なら更新。
                changed_fields = []
                for k, v in fields.items():
                    if getattr(obj, k) != v:
                        setattr(obj, k, v)
                        changed_fields.append(k)
                if changed_fields:
                    obj.save(update_fields=changed_fields)
            return obj

        # --------------------
        # Rank
        # --------------------
        bronze = upsert_rank("ブロンズ", 0, 3)
        silver = upsert_rank("シルバー", 50, 5)
        gold = upsert_rank("ゴールド", 150, 8)

        # --------------------
        # Users
        # --------------------
        u1 = upsert_user("jun@example.com", "jun", "password123", bronze, 10)
        u2 = upsert_user("yuki@example.com", "yuki", "password123", silver, 70)
        u3 = upsert_user("taro@example.com", "taro", "password123", gold, 210)

        # --------------------
        # StoreOwners
        # --------------------
        o1 = upsert_owner(
            "owner1@example.com",
            "ownerpass",
            name="田上商店 代表",
            business_name="田上商店",
            contact_phone="080-1111-2222",
            approved=True,
            is_verified=True,
            onboarding_completed=True,
        )
        o2 = upsert_owner(
            "owner2@example.com",
            "ownerpass",
            name="宇都宮カフェ 管理者",
            business_name="Utsunomiya Cafe",
            contact_phone="090-3333-4444",
            approved=True,
            is_verified=True,
            onboarding_completed=True,
        )

        # --------------------
        # Stores (unique by qr_code)
        # --------------------
        s1, _ = Store.objects.update_or_create(
            qr_code="STORE_QR_GYOZA_TAGAMI_0001",
            defaults={
                "owner": o1,
                "name": "餃子タガミ",
                "address": "栃木県宇都宮市1-2-3",
                "latitude": Decimal("36.5551000"),
                "longitude": Decimal("139.8825000"),
                "business_hours": "11:00-20:00",
                "business_hours_json": {
                    "mon": ["11:00", "20:00"],
                    "tue": ["11:00", "20:00"],
                    "wed": ["11:00", "20:00"],
                    "thu": ["11:00", "20:00"],
                    "fri": ["11:00", "21:00"],
                    "sat": ["11:00", "21:00"],
                    "sun": ["11:00", "20:00"],
                },
                "store_description": "宇都宮名物の餃子店。焼き餃子・水餃子どちらも人気。",
                "phone": "028-000-0001",
                "website": "https://example.com/gyoza",
                "instagram": "https://instagram.com/example_gyoza",
                "main_image": "stores/gyoza_tagami_main.jpg",
                "status": "approved",
                "is_featured": True,
                "priority": 10,
            },
        )
        s2, _ = Store.objects.update_or_create(
            qr_code="STORE_QR_MILKFOAM_LAB_0002",
            defaults={
                "owner": o2,
                "name": "ミルクフォーム研究所",
                "address": "栃木県宇都宮市4-5-6",
                "latitude": Decimal("36.5602000"),
                "longitude": Decimal("139.8801000"),
                "business_hours": "10:00-18:00",
                "business_hours_json": {
                    "mon": ["10:00", "18:00"],
                    "tue": ["10:00", "18:00"],
                    "wed": ["10:00", "18:00"],
                    "thu": ["10:00", "18:00"],
                    "fri": ["10:00", "18:00"],
                    "sat": ["10:00", "19:00"],
                    "sun": ["10:00", "19:00"],
                },
                "store_description": "抹茶ラテのフォームにこだわるカフェ。",
                "phone": "028-000-0002",
                "website": "https://example.com/latte",
                "instagram": "https://instagram.com/example_latte",
                "main_image": "stores/milkfoam_lab_main.jpg",
                "status": "approved",
                "is_featured": False,
                "priority": 5,
            },
        )

        # --------------------
        # Tags (unique by name)
        # --------------------
        t_food, _ = Tag.objects.update_or_create(
            name="グルメ",
            defaults={"category": "ジャンル", "display_order": 1, "is_active": True},
        )
        t_cafe, _ = Tag.objects.update_or_create(
            name="カフェ",
            defaults={"category": "ジャンル", "display_order": 2, "is_active": True},
        )
        t_family, _ = Tag.objects.update_or_create(
            name="家族向け",
            defaults={"category": "属性", "display_order": 10, "is_active": True},
        )
        t_takeout, _ = Tag.objects.update_or_create(
            name="テイクアウト",
            defaults={"category": "属性", "display_order": 11, "is_active": True},
        )

        StoreTag.objects.update_or_create(store=s1, tag=t_food, defaults={"added_by": o1})
        StoreTag.objects.update_or_create(store=s1, tag=t_takeout, defaults={"added_by": o1})
        StoreTag.objects.update_or_create(store=s2, tag=t_cafe, defaults={"added_by": o2})
        StoreTag.objects.update_or_create(store=s2, tag=t_family, defaults={"added_by": o2})

        # --------------------
        # Coupons (store + title)
        # expires_at is set only on create
        # --------------------
        c_common = upsert_coupon(
            None,
            "共通100円引き",
            create_only_expires_days=60,
            description="対象店舗ならどこでも使える割引。",
            required_points=30,
            type="common",
            publish_to_shop=True,
        )
        c_s1 = upsert_coupon(
            s1,
            "餃子1皿サービス",
            create_only_expires_days=30,
            description="来店時に餃子1皿サービス。",
            required_points=60,
            type="store_specific",
            publish_to_shop=True,
        )
        c_s2 = upsert_coupon(
            s2,
            "ラテトッピング無料",
            create_only_expires_days=45,
            description="フォーム増量またはシロップ追加。",
            required_points=40,
            type="store_specific",
            publish_to_shop=True,
        )

        # --------------------
        # Challenges (unique by qr_code)
        # --------------------
        ch1, _ = Challenge.objects.update_or_create(
            qr_code="CH_QR_GYOZA_BUY_0001",
            defaults={
                "store": s1,
                "title": "餃子購入でポイント獲得",
                "description": "会計後にQRを読み取ってください。",
                "reward_points": 15,
                "type": "PURCHASE",
                "quest_type": "store_specific",
                "reward_type": "points",
                "reward_coupon": None,
                "reward_detail": None,
                "is_banned": False,
            },
        )
        ch2, _ = Challenge.objects.update_or_create(
            qr_code="CH_QR_LATTE_PHOTO_0002",
            defaults={
                "store": s2,
                "title": "抹茶ラテ写真投稿",
                "description": "フォームがわかる写真を投稿。",
                "reward_points": 20,
                "type": "PHOTO",
                "quest_type": "store_specific",
                "reward_type": "coupon",
                "reward_coupon": c_s2,
                "reward_detail": None,
                "is_banned": False,
            },
        )
        ch3, _ = Challenge.objects.update_or_create(
            qr_code="CH_QR_GYOZA_VISIT_0003",
            defaults={
                "store": s1,
                "title": "来店スタンプ",
                "description": "来店してスタンプ1つ。",
                "reward_points": 5,
                "type": "VISIT",
                "quest_type": "store_specific",
                "reward_type": "points",
                "reward_coupon": None,
                "reward_detail": None,
                "is_banned": False,
            },
        )

        # --------------------
        # Progress / ownership tables
        # (Needs model unique constraints ideally; seed uses update_or_create anyway)
        # --------------------
        UserChallenge.objects.update_or_create(
            user=u1, challenge=ch1,
            defaults={"status": "in_progress", "proof_image": None, "approved_by_store": False, "cleared_at": None},
        )
        UserChallenge.objects.update_or_create(
            user=u2, challenge=ch2,
            defaults={"status": "cleared", "cleared_at": now - timedelta(days=1), "approved_by_store": True},
        )
        UserChallenge.objects.update_or_create(
            user=u3, challenge=ch3,
            defaults={"status": "retired", "proof_image": None, "approved_by_store": False, "cleared_at": None},
        )

        UserCoupon.objects.get_or_create(user=u2, coupon=c_s2, defaults={"is_used": False, "used_at": None})
        UserCoupon.objects.get_or_create(user=u3, coupon=c_common, defaults={"is_used": True, "used_at": now - timedelta(days=3)})

        setting1, _ = StoreStampSetting.objects.update_or_create(store=s1, defaults={"max_stamps": 10})

        StoreStampReward.objects.update_or_create(
            setting=setting1,
            stamp_threshold=5,
            defaults={
                "reward_type": "service",
                "reward_service_desc": "餃子トッピング（ねぎ）無料。",
                "reward_coupon": None,
                "display_order": 1,
            },
        )
        StoreStampReward.objects.update_or_create(
            setting=setting1,
            stamp_threshold=10,
            defaults={
                "reward_type": "coupon",
                "reward_coupon": c_s1,
                "reward_service_desc": "",
                "display_order": 2,
            },
        )

        StoreStamp.objects.update_or_create(user=u1, store=s1, defaults={"stamps_count": 3, "reward_given": False})
        StoreStamp.objects.update_or_create(user=u2, store=s1, defaults={"stamps_count": 6, "reward_given": False})

        # --------------------
        # Admin
        # --------------------
        upsert_admin(
            "admin@example.com",
            "adminpass",
            name="管理者",
            approval_status="approved",
            is_active=True,
        )

        AdminInquiry.objects.update_or_create(
            store=s1,
            related_challenge=ch1,
            category="審査",
            defaults={
                "message": "チャレンジの証跡画像が見えづらいため確認したい。",
                "status": "unread",
            },
        )

        self.stdout.write(self.style.SUCCESS("Seed completed (safe & idempotent)."))

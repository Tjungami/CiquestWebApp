# C:\Users\j_tagami\CiquestWebApp\ciquest_model\admin.py
from django.contrib import admin

from .models import (
    AdminAccount,
    AdminInquiry,
    Challenge,
    Coupon,
    Notice,
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


@admin.register(Rank)
class RankAdmin(admin.ModelAdmin):
    list_display = ("name", "required_points", "max_challenges_per_day")
    search_fields = ("name",)


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("username", "email", "rank", "points", "created_at")
    search_fields = ("username", "email")
    list_filter = ("rank",)


@admin.register(StoreOwner)
class StoreOwnerAdmin(admin.ModelAdmin):
    list_display = (
        "email",
        "name",
        "business_name",
        "approved",
        "is_verified",
        "onboarding_completed",
        "created_at",
    )
    search_fields = ("email", "name", "business_name")
    list_filter = ("approved", "is_verified", "onboarding_completed")


@admin.register(Store)
class StoreAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "status", "is_featured", "priority", "created_at")
    search_fields = ("name", "owner__email", "owner__name")
    list_filter = ("status", "is_featured")


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ("title", "store", "required_points", "type", "publish_to_shop", "expires_at")
    search_fields = ("title", "store__name")
    list_filter = ("type", "publish_to_shop")


@admin.register(Challenge)
class ChallengeAdmin(admin.ModelAdmin):
    list_display = ("title", "store", "type", "quest_type", "reward_type", "is_banned", "created_at")
    search_fields = ("title", "store__name")
    list_filter = ("type", "quest_type", "reward_type", "is_banned")


@admin.register(UserChallenge)
class UserChallengeAdmin(admin.ModelAdmin):
    list_display = ("user", "challenge", "status", "approved_by_store", "cleared_at")
    search_fields = ("user__username", "challenge__title")
    list_filter = ("status", "approved_by_store")


@admin.register(UserCoupon)
class UserCouponAdmin(admin.ModelAdmin):
    list_display = ("user", "coupon", "is_used", "used_at")
    search_fields = ("user__username", "coupon__title")
    list_filter = ("is_used",)


@admin.register(StoreStampSetting)
class StoreStampSettingAdmin(admin.ModelAdmin):
    list_display = ("store", "max_stamps", "created_at", "updated_at")
    search_fields = ("store__name",)


@admin.register(StoreStampReward)
class StoreStampRewardAdmin(admin.ModelAdmin):
    list_display = ("setting", "stamp_threshold", "reward_type", "reward_coupon", "display_order")
    search_fields = ("setting__store__name",)
    list_filter = ("reward_type",)


@admin.register(StoreStamp)
class StoreStampAdmin(admin.ModelAdmin):
    list_display = ("user", "store", "stamps_count", "reward_given")
    search_fields = ("user__username", "store__name")
    list_filter = ("reward_given",)


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "display_order", "is_active")
    search_fields = ("name", "category")
    list_filter = ("is_active",)


@admin.register(StoreTag)
class StoreTagAdmin(admin.ModelAdmin):
    list_display = ("store", "tag", "added_by", "created_at")
    search_fields = ("store__name", "tag__name", "added_by__email")


@admin.register(AdminAccount)
class AdminAccountAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "approval_status", "is_active", "is_deleted", "created_at")
    search_fields = ("name", "email")
    list_filter = ("approval_status", "is_active", "is_deleted")


@admin.register(AdminInquiry)
class AdminInquiryAdmin(admin.ModelAdmin):
    list_display = ("category", "store", "related_challenge", "status", "created_at")
    search_fields = ("category", "message", "store__name", "related_challenge__title")
    list_filter = ("status",)


@admin.register(Notice)
class NoticeAdmin(admin.ModelAdmin):
    list_display = ("title", "target", "is_published", "start_at", "end_at", "created_at")
    search_fields = ("title", "body_md")
    list_filter = ("target", "is_published")

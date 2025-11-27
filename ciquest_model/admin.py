# C:\Users\j_tagami\CiquestWebApp\ciquest_model\admin.py
from django.contrib import admin

from .models import StoreOwner, Store, Coupon, Challenge


@admin.register(StoreOwner)
class StoreOwnerAdmin(admin.ModelAdmin):
    list_display = ("email", "name", "business_name", "approved", "is_verified", "onboarding_completed", "created_at")
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

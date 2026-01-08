from django.contrib import admin
from .models import (
    Rank, User, StoreOwner, Store, Coupon, Challenge,
    UserChallenge, UserCoupon, StoreStampSetting, StoreStampReward,
    StoreStamp, Tag, StoreTag, AdminAccount, AdminInquiry
)

admin.site.register(Rank)
admin.site.register(User)
admin.site.register(StoreOwner)
admin.site.register(Store)
admin.site.register(Coupon)
admin.site.register(Challenge)
admin.site.register(UserChallenge)
admin.site.register(UserCoupon)
admin.site.register(StoreStampSetting)
admin.site.register(StoreStampReward)
admin.site.register(StoreStamp)
admin.site.register(Tag)
admin.site.register(StoreTag)
admin.site.register(AdminAccount)
admin.site.register(AdminInquiry)

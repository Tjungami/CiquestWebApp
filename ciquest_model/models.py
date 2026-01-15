# ciquest_model/models.py
from django.contrib.auth.hashers import identify_hasher, make_password
from django.db import models


def _hash_password_if_needed(value):
    """既にDjangoハッシュならそのまま、平文ならハッシュ化して返す"""
    if not value:
        return value
    try:
        identify_hasher(value)
        return value
    except ValueError:
        return make_password(value)


# ランク情報
class Rank(models.Model):
    rank_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50, unique=True)  # ★重複防止
    required_points = models.IntegerField()
    max_challenges_per_day = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return self.name


# ユーザー情報
class User(models.Model):
    user_id = models.AutoField(primary_key=True)
    username = models.CharField(max_length=50)
    email = models.EmailField(max_length=100, unique=True)
    password = models.CharField(max_length=255)
    rank = models.ForeignKey(Rank, on_delete=models.SET_NULL, null=True)
    points = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.username

    def save(self, *args, **kwargs):
        # 平文ならハッシュ化（ハッシュならそのまま）
        self.password = _hash_password_if_needed(self.password)
        super().save(*args, **kwargs)


class UserRefreshToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="refresh_tokens")
    token_hash = models.CharField(max_length=64, unique=True)
    issued_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"UserRefreshToken(user_id={self.user_id})"


# 店舗オーナー
class StoreOwner(models.Model):
    owner_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100, blank=True)
    business_name = models.CharField(max_length=150, blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(max_length=100, unique=True)
    password = models.CharField(max_length=255)
    approved = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    verification_token = models.CharField(max_length=128, blank=True, null=True)
    verification_sent_at = models.DateTimeField(null=True, blank=True)
    onboarding_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name or self.business_name or str(self.owner_id)

    def save(self, *args, **kwargs):
        self.password = _hash_password_if_needed(self.password)
        super().save(*args, **kwargs)


# 店舗
class Store(models.Model):
    STATUS_CHOICES = [
        ("pending", "審査中"),
        ("approved", "承認済み"),
        ("rejected", "却下"),
    ]

    store_id = models.AutoField(primary_key=True)
    owner = models.ForeignKey(StoreOwner, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    address = models.CharField(max_length=255)
    latitude = models.DecimalField(max_digits=15, decimal_places=12)
    longitude = models.DecimalField(max_digits=15, decimal_places=12)
    business_hours = models.CharField(max_length=100, blank=True, null=True)
    business_hours_json = models.JSONField(blank=True, null=True)
    store_description = models.TextField(blank=True, null=True)
    phone = models.CharField(max_length=30, blank=True, null=True)
    website = models.URLField(blank=True, null=True)
    instagram = models.URLField(blank=True, null=True)
    main_image = models.CharField(max_length=255, blank=True, null=True)
    qr_code = models.CharField(max_length=255, unique=True)  # もともとOK
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    is_featured = models.BooleanField(default=False)
    priority = models.IntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


# クーポン
class Coupon(models.Model):
    TYPE_CHOICES = [
        ("common", "共通"),
        ("store_specific", "店舗独自"),
    ]

    coupon_id = models.AutoField(primary_key=True)
    store = models.ForeignKey(Store, on_delete=models.SET_NULL, null=True, blank=True)
    title = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    required_points = models.IntegerField()
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="common")
    expires_at = models.DateTimeField(null=True, blank=True)
    publish_to_shop = models.BooleanField(default=True)

    class Meta:
        # 店舗内で同じタイトルが増殖しないように（store=None も含むが、DB的には許容される）
        constraints = [
            models.UniqueConstraint(fields=["store", "title"], name="uq_coupon_store_title"),
        ]

    def __str__(self):
        return self.title


# チャレンジ
class Challenge(models.Model):
    TYPE_CHOICES = [
        ("PURCHASE", "購入"),
        ("PHOTO", "写真投稿"),
        ("VISIT", "来店"),
    ]

    QUEST_CHOICES = [
        ("common", "共通"),
        ("store_specific", "店舗独自"),
    ]

    REWARD_CHOICES = [
        ("points", "ポイント"),
        ("coupon", "クーポン"),
        ("service", "サービス"),
    ]

    challenge_id = models.AutoField(primary_key=True)
    store = models.ForeignKey(Store, on_delete=models.CASCADE)
    title = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    reward_points = models.IntegerField()
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    quest_type = models.CharField(max_length=20, choices=QUEST_CHOICES)
    reward_type = models.CharField(max_length=20, choices=REWARD_CHOICES, default="points")
    reward_detail = models.CharField(max_length=255, blank=True, null=True)
    qr_code = models.CharField(max_length=255, blank=True, null=True)
    reward_coupon = models.ForeignKey(Coupon, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_banned = models.BooleanField(default=False)

    class Meta:
        # qr_code を使うならユニーク推奨（空/NULLがあり得るので constraints で条件付きが理想）
        constraints = [
            models.UniqueConstraint(fields=["qr_code"], name="uq_challenge_qr_code"),
        ]

    def __str__(self):
        return self.title


# チャレンジ進捗
class UserChallenge(models.Model):
    STATUS_CHOICES = [
        ("in_progress", "進行中"),
        ("cleared", "クリア"),
        ("retired", "リタイア"),
    ]

    user_challenge_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="in_progress")
    proof_image = models.CharField(max_length=255, blank=True, null=True)
    approved_by_store = models.BooleanField(default=False)
    cleared_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "challenge"], name="uq_user_challenge"),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.challenge.title}"


# ユーザー所持クーポン
class UserCoupon(models.Model):
    user_coupon_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE)
    is_used = models.BooleanField(default=False)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "coupon"], name="uq_user_coupon"),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.coupon.title}"


# スタンプカード
class StoreStampSetting(models.Model):
    store = models.OneToOneField(Store, on_delete=models.CASCADE, related_name="stamp_setting")
    max_stamps = models.PositiveSmallIntegerField(default=30)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.store.name} - 設定"


class StoreStampReward(models.Model):
    REWARD_TYPE_CHOICES = [
        ("coupon", "クーポン"),
        ("service", "サービス"),
    ]

    setting = models.ForeignKey(StoreStampSetting, on_delete=models.CASCADE, related_name="rewards")
    stamp_threshold = models.PositiveSmallIntegerField()
    reward_type = models.CharField(max_length=20, choices=REWARD_TYPE_CHOICES)
    reward_coupon = models.ForeignKey(Coupon, on_delete=models.SET_NULL, null=True, blank=True)
    reward_service_desc = models.CharField(max_length=255, blank=True)
    display_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["display_order", "stamp_threshold"]
        constraints = [
            models.UniqueConstraint(fields=["setting", "stamp_threshold"], name="uq_stamp_reward_threshold"),
        ]

    def __str__(self):
        return f"{self.setting.store.name} - {self.stamp_threshold}個"


class StoreStamp(models.Model):
    stamp_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    store = models.ForeignKey(Store, on_delete=models.CASCADE)
    stamps_count = models.IntegerField(default=0)
    reward_given = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "store"], name="uq_store_stamp_user_store"),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.store.name}"


# タグ
class Tag(models.Model):
    tag_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50, unique=True)  # ★重複防止
    category = models.CharField(max_length=50, null=True, blank=True)
    display_order = models.IntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


# 店舗タグ中間テーブル
class StoreTag(models.Model):
    store = models.ForeignKey(Store, on_delete=models.CASCADE)
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE)
    added_by = models.ForeignKey(StoreOwner, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("store", "tag")

    def __str__(self):
        return f"{self.store.name} - {self.tag.name}"


class AdminAccount(models.Model):
    admin_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    email = models.EmailField(max_length=100, unique=True)
    password = models.CharField(max_length=255, blank=True)

    APPROVAL_CHOICES = [
        ("pending", "申請中"),
        ("approved", "承認済み"),
        ("rejected", "却下"),
    ]
    approval_status = models.CharField(max_length=20, choices=APPROVAL_CHOICES, default="pending")

    created_by = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="created_admins")
    approved_by = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="approved_admins")
    approved_at = models.DateTimeField(null=True, blank=True)

    is_active = models.BooleanField(default=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    restore_token = models.CharField(max_length=128, blank=True, null=True)
    restore_token_expires_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.get_approval_status_display()})"

    def save(self, *args, **kwargs):
        self.password = _hash_password_if_needed(self.password)
        super().save(*args, **kwargs)


class AdminInquiry(models.Model):
    STATUS_CHOICES = [
        ("unread", "未読"),
        ("in_progress", "対応中"),
        ("resolved", "対応済み"),
    ]

    inquiry_id = models.AutoField(primary_key=True)
    store = models.ForeignKey(Store, on_delete=models.SET_NULL, null=True, blank=True)
    related_challenge = models.ForeignKey(Challenge, on_delete=models.SET_NULL, null=True, blank=True)
    category = models.CharField(max_length=50)
    message = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="unread")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # 同じ「店 + チャレンジ + カテゴリ」の問い合わせが増殖しないように（任意）
        constraints = [
            models.UniqueConstraint(fields=["store", "related_challenge", "category"], name="uq_admin_inquiry_key"),
        ]

    def __str__(self):
        base = self.category or "問い合わせ"
        return f"{base} - {self.get_status_display()}"


class Notice(models.Model):
    TARGET_CHOICES = [
        ("all", "全員"),
        ("owner", "オーナー"),
        ("user", "ユーザー"),
    ]

    notice_id = models.AutoField(primary_key=True)
    title = models.CharField(max_length=120)
    body_md = models.TextField()
    target = models.CharField(max_length=20, choices=TARGET_CHOICES, default="all")
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    is_published = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        AdminAccount,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_notices",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_at", "-created_at"]

    def __str__(self):
        return self.title

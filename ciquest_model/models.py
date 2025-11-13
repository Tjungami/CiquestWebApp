# C:\Users\j_tagami\CiquestWebApp\ciquest_model\models.py
from django.db import models

# ランク情報
class Rank(models.Model):
    rank_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50)
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


# 店舗オーナー
class StoreOwner(models.Model):
    owner_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    email = models.EmailField(max_length=100, unique=True)
    password = models.CharField(max_length=255)
    approved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


# 店舗
class Store(models.Model):
    STATUS_CHOICES = [
        ('pending', '審査中'),
        ('approved', '承認済み'),
        ('rejected', '却下'),
    ]

    store_id = models.AutoField(primary_key=True)
    owner = models.ForeignKey(StoreOwner, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    address = models.CharField(max_length=255)
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)
    business_hours = models.CharField(max_length=100, blank=True, null=True)
    store_description = models.TextField(blank=True, null=True)
    qr_code = models.CharField(max_length=255, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


# クーポン
class Coupon(models.Model):
    TYPE_CHOICES = [
        ('common', '共通'),
        ('store_specific', '店舗独自'),
    ]

    coupon_id = models.AutoField(primary_key=True)
    store = models.ForeignKey(Store, on_delete=models.SET_NULL, null=True, blank=True)
    title = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    required_points = models.IntegerField()
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='common')
    expires_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.title


# チャレンジ
class Challenge(models.Model):
    TYPE_CHOICES = [
        ('PURCHASE', '購入'),
        ('PHOTO', '写真投稿'),
        ('VISIT', '来店'),
    ]

    QUEST_CHOICES = [
        ('common', '共通'),
        ('store_specific', '店舗独自'),
    ]

    REWARD_CHOICES = [
        ('points', 'ポイント'),
        ('coupon', 'クーポン'),
        ('service', 'サービス'),
    ]

    challenge_id = models.AutoField(primary_key=True)
    store = models.ForeignKey(Store, on_delete=models.CASCADE)
    title = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    reward_points = models.IntegerField()
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    quest_type = models.CharField(max_length=20, choices=QUEST_CHOICES)
    reward_type = models.CharField(max_length=20, choices=REWARD_CHOICES, default='points')
    reward_detail = models.CharField(max_length=255, blank=True, null=True)
    qr_code = models.CharField(max_length=255, blank=True, null=True)
    reward_coupon = models.ForeignKey(Coupon, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


# チャレンジ進捗
class UserChallenge(models.Model):
    STATUS_CHOICES = [
        ('in_progress', '進行中'),
        ('cleared', 'クリア'),
        ('retired', 'リタイア'),
    ]

    user_challenge_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='in_progress')
    proof_image = models.CharField(max_length=255, blank=True, null=True)
    approved_by_store = models.BooleanField(default=False)
    cleared_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.user.username} - {self.challenge.title}"


# ユーザー所持クーポン
class UserCoupon(models.Model):
    user_coupon_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE)
    is_used = models.BooleanField(default=False)
    used_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.user.username} - {self.coupon.title}"


# スタンプカード
class StoreStamp(models.Model):
    stamp_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    store = models.ForeignKey(Store, on_delete=models.CASCADE)
    stamps_count = models.IntegerField(default=0)
    reward_given = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.username} - {self.store.name}"


# タグ
class Tag(models.Model):
    tag_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50)
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
        unique_together = ('store', 'tag')

    def __str__(self):
        return f"{self.store.name} - {self.tag.name}"

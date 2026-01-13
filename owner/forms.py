# C:\Users\j_tagami\CiquestWebApp\owner\forms.py

import datetime
import re
from decimal import Decimal, InvalidOperation

from django import forms

from ciquest_model.models import Challenge, Coupon, Store, StoreStampReward


COUPON_TIME_CHOICES = [('', '時間を選択')] + [

    (f"{hour:02d}:00", f"{hour:02d}:00") for hour in range(24)

]





class CouponExpiryWidget(forms.MultiWidget):

    def __init__(self, attrs=None):

        widgets = [

            forms.DateInput(attrs={'type': 'date'}),

            forms.Select(choices=COUPON_TIME_CHOICES, attrs={'class': 'time-select'}),

        ]

        super().__init__(widgets, attrs)



    def decompress(self, value):

        if value:

            return [value.date(), value.strftime('%H:%M')]

        return [None, None]





class CouponExpiryField(forms.MultiValueField):

    def __init__(self, *args, **kwargs):

        fields = (

            forms.DateField(required=False, input_formats=['%Y-%m-%d']),

            forms.ChoiceField(required=False, choices=COUPON_TIME_CHOICES),

        )

        super().__init__(fields=fields, require_all_fields=False, *args, **kwargs)

        self.widget = CouponExpiryWidget()



    def compress(self, data_list):

        if not data_list:

            return None

        date_value, time_value = data_list

        if not date_value:

            return None

        if not time_value:

            raise forms.ValidationError("時間を選択してください。")

        hour, minute = map(int, time_value.split(':'))

        return datetime.datetime.combine(date_value, datetime.time(hour, minute))





class ChallengeForm(forms.ModelForm):

    def __init__(self, *args, **kwargs):

        super().__init__(*args, **kwargs)

        # reward_points はフォーム上で入力しないため任意扱いにする

        self.fields['reward_points'].required = False



    class Meta:

        model = Challenge

        fields = ['title', 'description', 'reward_points', 'reward_coupon', 'reward_detail', 'type', 'quest_type', 'reward_type']

        widgets = {

            'title': forms.TextInput(attrs={

                'placeholder': '例：写真を撮って投稿しよう',

                'maxlength': 100

            }),

            'description': forms.Textarea(attrs={

                'rows': 4,

                'maxlength': 500,

                'placeholder': 'チャレンジの詳細説明を入力してください'

            }),

            'reward_detail': forms.TextInput(attrs={

                'placeholder': 'サービス内容や付帯条件を入力',

                'maxlength': 255

            }),

        }



    def clean_title(self):

        title = self.cleaned_data['title']

        if len(title) > 100:

            raise forms.ValidationError("タイトルは100文字以内で入力してください。")

        return title



    def clean_description(self):

        description = self.cleaned_data.get('description')

        if description and len(description) > 500:

            raise forms.ValidationError("説明文は500文字以内で入力してください。")

        return description



    def clean(self):

        cleaned_data = super().clean()

        quest_type = cleaned_data.get('quest_type')

        reward_type = cleaned_data.get('reward_type')

        reward_coupon = cleaned_data.get('reward_coupon')

        reward_detail = cleaned_data.get('reward_detail')



        if quest_type == 'store_specific' and reward_type == 'coupon' and not reward_coupon:

            self.add_error('reward_coupon', "クーポン報酬を選択してください。")

        if reward_type == 'service' and not reward_detail:

            self.add_error('reward_detail', "サービス報酬の内容を入力してください。")



        return cleaned_data





class CouponForm(forms.ModelForm):

    expires_at = CouponExpiryField(required=False)



    class Meta:

        model = Coupon

        fields = ['title', 'description', 'required_points', 'publish_to_shop', 'expires_at']

        widgets = {

            'title': forms.TextInput(attrs={

                'placeholder': '例：500円割引クーポン',

                'maxlength': 100

            }),

            'description': forms.Textarea(attrs={

                'rows': 4,

                'maxlength': 500,

                'placeholder': '利用条件・対象商品などを入力してください'

            }),

            'required_points': forms.NumberInput(attrs={

                'min': 0,

                'step': 10

            }),

            'publish_to_shop': forms.CheckboxInput(),

        }



    def clean_title(self):

        title = self.cleaned_data['title']

        if len(title) > 100:

            raise forms.ValidationError("タイトルは100文字以内で入力してください。")

        return title



    def clean_description(self):

        description = self.cleaned_data.get('description', '')

        if description and len(description) > 500:

            raise forms.ValidationError("説明文は500文字以内で入力してください。")

        return description



    def clean_required_points(self):

        points = self.cleaned_data['required_points']

        if points < 0:

            raise forms.ValidationError("必要ポイントは0以上を入力してください。")

        return points



class StampEventForm(forms.Form):
    stamp_threshold = forms.IntegerField(

        label="必要スタンプ数",

        min_value=1,

        max_value=30,

        widget=forms.NumberInput(attrs={"min": 1, "max": 30})

    )

    reward_type = forms.ChoiceField(

        label="報酬タイプ",

        choices=StoreStampReward.REWARD_TYPE_CHOICES,

        widget=forms.RadioSelect

    )

    reward_coupon = forms.ModelChoiceField(

        label="クーポン報酬",

        queryset=Coupon.objects.none(),

        required=False,

        empty_label="クーポンを選択"

    )

    reward_service_desc = forms.CharField(

        label="サービス内容",

        required=False,

        widget=forms.TextInput(attrs={"placeholder": "例：トッピング無料、限定メニュー提供など"})

    )



    def __init__(self, *args, coupon_queryset=None, **kwargs):

        super().__init__(*args, **kwargs)

        if coupon_queryset is not None:

            self.fields["reward_coupon"].queryset = coupon_queryset



    def clean(self):

        cleaned_data = super().clean()

        reward_type = cleaned_data.get("reward_type")

        reward_coupon = cleaned_data.get("reward_coupon")

        reward_service_desc = cleaned_data.get("reward_service_desc")



        if reward_type == "coupon" and not reward_coupon:

            self.add_error("reward_coupon", "クーポン報酬を選択してください。")

        if reward_type == "service" and not reward_service_desc:

            self.add_error("reward_service_desc", "サービス内容を入力してください。")



        return cleaned_data



class StoreApplicationForm(forms.ModelForm):
    latlng = forms.CharField(
        required=True,
        label="緯度・経度",
        widget=forms.TextInput(
            attrs={
                "inputmode": "decimal",
                "placeholder": "36.558219721380816, 139.90246302270646 のようにカンマ区切りで入力",
            }
        ),
    )
    latitude = forms.DecimalField(required=False, widget=forms.HiddenInput())
    longitude = forms.DecimalField(required=False, widget=forms.HiddenInput())

    class Meta:
        model = Store
        fields = [
            "name",
            "address",
            "latlng",
            "latitude",
            "longitude",
            "business_hours",
            "store_description",
        ]
        widgets = {
            "name": forms.TextInput(
                attrs={
                    "placeholder": "例：CIquest カフェ本店",
                    "maxlength": 100,
                }
            ),
            "address": forms.TextInput(
                attrs={
                    "placeholder": "例：東京都千代田区1-2-3",
                    "maxlength": 255,
                }
            ),
            "business_hours": forms.TextInput(
                attrs={
                    "placeholder": "例：10:00～20:00（定休日：水曜）",
                    "maxlength": 100,
                }
            ),
            "store_description": forms.Textarea(
                attrs={
                    "rows": 4,
                    "maxlength": 500,
                    "placeholder": "店舗の特徴や提供サービスを記載してください",
                }
            ),
        }

    @staticmethod
    def _split_lat_lng(value: str):
        # Support "lat, lng" paste from Google Maps (Japanese comma also)
        if value is None:
            return None

        normalized = (
            value.replace("，", ",")
            .replace("、", ",")
            .replace("､", ",")
            .replace("　", " ")
        )

        if "," in normalized:
            parts = [part.strip() for part in normalized.split(",") if part.strip()]
            if len(parts) == 2:
                return parts[0], parts[1]

        parts = [part for part in re.split(r"\s+", normalized.strip()) if part]
        if len(parts) == 2:
            return parts[0], parts[1]

        return None

    def _to_decimal(self, raw_value, error_field, min_value, max_value, range_error_message, sample):
        if raw_value in (None, ""):
            self.add_error(error_field, "この項目を入力してください。")
            return None

        if isinstance(raw_value, str):
            translation = str.maketrans({
                '\uFF10': '0', '\uFF11': '1', '\uFF12': '2', '\uFF13': '3', '\uFF14': '4',
                '\uFF15': '5', '\uFF16': '6', '\uFF17': '7', '\uFF18': '8', '\uFF19': '9',
                '\uFF0E': '.', '\uFF0D': '-', '\u2212': '-', '\u2015': '-'
            })
            raw_value = raw_value.translate(translation)

        try:
            decimal_value = Decimal(str(raw_value))
        except (InvalidOperation, ValueError):
            self.add_error(error_field, f"??????????????: {sample}?")
            return None

        if decimal_value < Decimal(min_value) or decimal_value > Decimal(max_value):
            self.add_error(error_field, range_error_message)
            return None

        return decimal_value

    def clean(self):
        cleaned_data = super().clean()

        latlng_input = cleaned_data.get("latlng")
        lat_input = cleaned_data.get("latitude")
        lng_input = cleaned_data.get("longitude")

        combined = self._split_lat_lng(latlng_input)

        if combined:
            lat_input, lng_input = combined
        else:
            if latlng_input not in (None, ""):
                self.add_error("latlng", "緯度と経度をカンマ区切りで入力してください。（例: 36.558219721380816, 139.90246302270646）")
                return cleaned_data

        if lat_input in (None, "") or lng_input in (None, ""):
            self.add_error("latlng", "この項目を入力してください。")
            return cleaned_data

        latitude = self._to_decimal(
            lat_input,
            "latlng",
            -90,
            90,
            "緯度は-90.0〜90.0の範囲で入力してください。",
            "36.558219721380816",
        )
        longitude = self._to_decimal(
            lng_input,
            "latlng",
            -180,
            180,
            "経度は-180.0〜180.0の範囲で入力してください。",
            "139.90246302270646",
        )

        if latitude is not None:
            cleaned_data["latitude"] = latitude
        if longitude is not None:
            cleaned_data["longitude"] = longitude

        return cleaned_data

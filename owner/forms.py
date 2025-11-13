# C:\Users\j_tagami\CiquestWebApp\owner\forms.py
from django import forms
from ciquest_model.models import Challenge, Coupon


class ChallengeForm(forms.ModelForm):
    class Meta:
        model = Challenge
        fields = ['title', 'description', 'reward_points', 'reward_coupon', 'type', 'quest_type', 'reward_type']
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


class CouponForm(forms.ModelForm):
    expires_at = forms.DateTimeField(
        required=False,
        widget=forms.DateTimeInput(attrs={'type': 'datetime-local'})
    )

    class Meta:
        model = Coupon
        fields = ['title', 'description', 'required_points', 'type', 'expires_at']
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

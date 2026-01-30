import re

from django import forms

from ciquest_model.models import AdminAccount, StoreOwner


class OwnerSignupForm(forms.Form):
    email = forms.EmailField(
        label="メールアドレス",
        widget=forms.EmailInput(attrs={"placeholder": "owner@example.com", "autocomplete": "email"}),
    )
    password1 = forms.CharField(
        label="パスワード",
        widget=forms.PasswordInput(attrs={"autocomplete": "new-password"}),
        min_length=8,
        help_text="8文字以上で入力してください。",
    )
    password2 = forms.CharField(
        label="パスワード（確認）",
        widget=forms.PasswordInput(attrs={"autocomplete": "new-password"}),
        min_length=8,
    )

    def clean_email(self):
        email = self.cleaned_data["email"].lower()
        if StoreOwner.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("このメールアドレスは既に登録されています。")
        return email

    def clean(self):
        cleaned_data = super().clean()
        password1 = cleaned_data.get("password1")
        password2 = cleaned_data.get("password2")
        if password1 and password2 and password1 != password2:
            self.add_error("password2", "確認用パスワードが一致しません。")
        return cleaned_data


class OwnerProfileForm(forms.Form):
    name = forms.CharField(
        label="代表者氏名",
        max_length=100,
        widget=forms.TextInput(attrs={"placeholder": "CIquest 太郎"}),
    )
    business_name = forms.CharField(
        label="店舗 / 事業者名",
        max_length=150,
        required=False,
        widget=forms.TextInput(attrs={"placeholder": "Ciquest Café 本店"}),
    )
    contact_phone = forms.CharField(
        label="連絡先電話番号",
        max_length=20,
        required=False,
        widget=forms.TextInput(attrs={"placeholder": "090-1234-5678"}),
        help_text="ハイフンあり/なし、どちらでも構いません。",
    )

    def clean_contact_phone(self):
        value = self.cleaned_data.get("contact_phone", "") or ""
        value = value.strip()
        if not value:
            return value

        translation = str.maketrans({
            "\uFF10": "0",
            "\uFF11": "1",
            "\uFF12": "2",
            "\uFF13": "3",
            "\uFF14": "4",
            "\uFF15": "5",
            "\uFF16": "6",
            "\uFF17": "7",
            "\uFF18": "8",
            "\uFF19": "9",
            "\uFF0D": "-",
            "\u2212": "-",
            "\u2015": "-",
            "\u30FC": "-",
            "\u2010": "-",
        })
        normalized = value.translate(translation)
        normalized = re.sub(r"\s+", "", normalized)

        if not re.fullmatch(r"[0-9-]+", normalized):
            raise forms.ValidationError("????????????????????????")

        digits = re.sub(r"\D", "", normalized)
        if len(digits) not in (10, 11):
            raise forms.ValidationError("?????10????11???????????")

        return normalized


class AdminSignupForm(forms.Form):
    name = forms.CharField(
        label="氏名",
        max_length=100,
        widget=forms.TextInput(attrs={"placeholder": "管理者 太郎"}),
    )
    email = forms.EmailField(
        label="メールアドレス",
        widget=forms.EmailInput(attrs={"placeholder": "admin@example.com", "autocomplete": "email"}),
    )
    password1 = forms.CharField(
        label="パスワード",
        widget=forms.PasswordInput(attrs={"autocomplete": "new-password"}),
        min_length=8,
    )
    password2 = forms.CharField(
        label="パスワード（確認）",
        widget=forms.PasswordInput(attrs={"autocomplete": "new-password"}),
        min_length=8,
    )

    def clean_email(self):
        email = self.cleaned_data["email"].lower()
        if AdminAccount.objects.filter(email__iexact=email, is_deleted=False).exists():
            raise forms.ValidationError("このメールアドレスは既に運営アカウントとして登録されています。")
        return email

    def clean(self):
        cleaned_data = super().clean()
        pw1 = cleaned_data.get("password1")
        pw2 = cleaned_data.get("password2")
        if pw1 and pw2 and pw1 != pw2:
            self.add_error("password2", "確認用パスワードが一致しません。")
        return cleaned_data

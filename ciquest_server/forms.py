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

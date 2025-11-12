from django import forms
from ciquest_model.models import Challenge

class ChallengeForm(forms.ModelForm):
    class Meta:
        model = Challenge
        fields = fields = ['title', 'description', 'reward_points', 'reward_coupon', 'type', 'quest_type', 'reward_type']
        widgets = {
            'title': forms.TextInput(attrs={
                'placeholder': '例：写真を撮って投稿しよう！',
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
        description = self.cleaned_data['description']
        if len(description) > 500:
            raise forms.ValidationError("説明は500文字以内で入力してください。")
        return description

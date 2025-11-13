# C:\Users\j_tagami\CiquestWebApp\ciquest_server\urls.py
from django.contrib import admin
from django.urls import path, include
from django.shortcuts import redirect

urlpatterns = [
    path('admin/', admin.site.urls),
    path('owner/', include('owner.urls')),
    path('', lambda request: redirect('login')),  # トップページはログインへ
]

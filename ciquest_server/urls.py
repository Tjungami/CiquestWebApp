# C:\Users\j_tagami\CiquestWebApp\ciquest_server\urls.py
from django.contrib import admin
from django.urls import path, include
from django.shortcuts import redirect
from django.templatetags.static import static
from django.views.generic.base import RedirectView

from . import views

urlpatterns = [
    path('favicon.ico', RedirectView.as_view(url=static('img/common/CIquest.ico'), permanent=True)),
    path('admin/', admin.site.urls),
    path('owner/', include('owner.urls')),
    path('operator/', include('admin_panel.urls')),
    path('signup/', views.signup_view, name='signup'),
    path('admin-signup/', views.admin_signup_view, name='admin_signup'),
    path('signup/verify/', views.signup_verify_view, name='signup_verify'),
    path('onboarding/', views.onboarding_view, name='owner_onboarding'),
    path('login/', views.unified_login, name='login'),
    path('logout/', views.unified_logout, name='logout'),
    path('api/users/', views.api_user_create, name='api_user_create'),
    path('api/login/', views.api_login, name='api_login'),
    path('api/token/refresh/', views.api_token_refresh, name='api_token_refresh'),
    path('api/logout/', views.api_logout, name='api_logout'),
    path('api/me/', views.api_me, name='api_me'),
    path('api/user-challenges/clear/', views.api_user_challenge_clear, name='api_user_challenge_clear'),
    path('api/user-coupons/use/', views.api_user_coupon_use, name='api_user_coupon_use'),
    path('api/user-coupons/history/', views.api_user_coupon_history, name='api_user_coupon_history'),
    path('api/store-coupons/history/', views.api_store_coupon_history, name='api_store_coupon_history'),
    path('api/stamps/scan/', views.api_store_stamp_scan, name='api_store_stamp_scan'),
    path('api/stores/', views.public_store_list, name='public_store_list'),
    path('api/stamp-settings/', views.public_stamp_setting, name='public_stamp_setting'),
    path('api/coupons/', views.public_coupon_list, name='public_coupon_list'),
    path('api/challenges/', views.public_challenge_list, name='public_challenge_list'),
    path('api/notices/', views.public_notice_list, name='public_notice_list'),
    path('', lambda request: redirect('login')),
]

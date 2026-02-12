# C:\Users\j_tagami\CiquestWebApp\owner\urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('login/', views.login_view, name='owner_login'),
    path('dashboard/', views.dashboard, name='owner_dashboard'),
    path('dashboard/notices/', views.owner_notices, name='owner_notices'),
    path('dashboard/inquiries/', views.owner_inquiries, name='owner_inquiries'),
    path('home/<int:store_id>/', views.store_home, name='owner_store_home'),
    path('logout/', views.logout_view, name='owner_logout'),
    path('create_challenge/', views.create_challenge, name='create_challenge'),
    path('create_challenge/success/', views.create_challenge_success, name='create_challenge_success'),
    path('create_coupon/', views.create_coupon, name='create_coupon'),
    path('create_coupon/success/', views.create_coupon_success, name='create_coupon_success'),
    path('coupons/', views.coupon_list, name='coupon_list'),
    path('coupons/<int:coupon_id>/edit/', views.edit_coupon, name='edit_coupon'),
    path('coupons/<int:coupon_id>/delete/', views.delete_coupon, name='delete_coupon'),
    path('stamp-settings/', views.stamp_settings, name='stamp_settings'),
    path('stamp-settings/delete/', views.delete_stamp_settings, name='delete_stamp_settings'),
    path('stamp-settings/events/new/', views.create_stamp_event, name='create_stamp_event'),
    path('stamp-settings/events/<int:event_id>/edit/', views.edit_stamp_event, name='edit_stamp_event'),
    path('stamp-settings/events/<int:event_id>/delete/', views.delete_stamp_event, name='delete_stamp_event'),
    path('challenges/', views.my_challenges, name='my_challenges'),
    path('challenges/<int:challenge_id>/edit/', views.edit_challenge, name='edit_challenge'),
    path('challenges/<int:challenge_id>/delete/', views.delete_challenge, name='delete_challenge'),
    path('stats/', views.stats, name='stats'),
]

from django.urls import path

from . import views

urlpatterns = [
    path('', views.admin_dashboard, name='admin_dashboard'),
    path('stores/', views.stores_dashboard, name='admin_stores'),
    path('challenges/', views.challenges_dashboard, name='admin_challenges'),
    path('coupons/', views.coupons_dashboard, name='admin_coupons'),
    path('inquiries/', views.inquiries_dashboard, name='admin_inquiries'),
    path('admins/', views.admins_dashboard, name='admin_admins'),
    path('api/stores/', views.api_store_list, name='admin_api_stores'),
    path(
        'api/stores/<int:store_id>/<str:new_status>/',
        views.api_store_update_status,
        name='admin_api_store_update',
    ),
    path(
        'api/stores/<int:store_id>/delete/',
        views.api_store_delete,
        name='admin_api_store_delete',
    ),
    path('api/challenges/', views.api_challenge_list, name='admin_api_challenges'),
    path(
        'api/challenges/<int:challenge_id>/ban/',
        views.api_challenge_ban,
        name='admin_api_challenge_ban',
    ),
    path('api/coupons/', views.api_coupon_list_create, name='admin_api_coupons'),
    path(
        'api/coupons/<int:coupon_id>/update_points/',
        views.api_coupon_update_points,
        name='admin_api_coupon_update_points',
    ),
    path(
        'api/coupons/<int:coupon_id>/delete/',
        views.api_coupon_delete,
        name='admin_api_coupon_delete',
    ),
    path('api/admins/', views.api_admin_list_create, name='admin_api_admins'),
    path(
        'api/admins/<int:admin_id>/approve/',
        views.api_admin_approve,
        name='admin_api_admin_approve',
    ),
    path(
        'api/admins/<int:admin_id>/delete/',
        views.api_admin_delete,
        name='admin_api_admin_delete',
    ),
    path(
        'admins/<int:admin_id>/restore/<str:token>/',
        views.admin_account_restore,
        name='admin_account_restore',
    ),
    path('api/inquiries/', views.api_inquiry_list, name='admin_api_inquiries'),
    path(
        'api/inquiries/<int:inquiry_id>/update_status/',
        views.api_inquiry_update_status,
        name='admin_api_inquiry_update_status',
    ),
]

# C:\Users\j_tagami\CiquestWebApp\ciquest_server\urls.py
from django.contrib import admin
from django.urls import path, include
from django.shortcuts import redirect

from . import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('owner/', include('owner.urls')),
    path('operator/', include('admin_panel.urls')),
    path('signup/', views.signup_view, name='signup'),
    path('signup/verify/', views.signup_verify_view, name='signup_verify'),
    path('onboarding/', views.onboarding_view, name='owner_onboarding'),
    path('login/', views.unified_login, name='login'),
    path('logout/', views.unified_logout, name='logout'),
    path('', lambda request: redirect('login')),
]

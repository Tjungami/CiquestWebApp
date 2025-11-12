from django.urls import path
from . import views

urlpatterns = [
    path('login/', views.login_view, name='login'),
    path('dashboard/', views.dashboard, name='owner_dashboard'),
    path('home/<int:store_id>/', views.store_home, name='owner_store_home'),
    path('logout/', views.logout_view, name='logout'),
    path('create_challenge/', views.create_challenge, name='create_challenge'),
    path('create_challenge/success/', views.create_challenge_success, name='create_challenge_success'),
]

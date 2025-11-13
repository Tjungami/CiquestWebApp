# C:\Users\j_tagami\CiquestWebApp\admin_panel\urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('', views.dashboard, name='admin_dashboard'),
]

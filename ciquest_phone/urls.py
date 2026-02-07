from django.urls import path
from . import views

urlpatterns = [
    path("", views.home, name="ciquest_phone_home"),
    path("notices/", views.notices, name="ciquest_phone_notices"),
    path("stores/<int:store_id>/", views.store_detail, name="ciquest_phone_store_detail"),
]

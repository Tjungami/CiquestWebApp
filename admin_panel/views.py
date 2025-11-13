# C:\Users\j_tagami\CiquestWebApp\admin_panel\views.py
from django.shortcuts import render

def dashboard(request):
    context = {'page_title': '運営ダッシュボード'}
    return render(request, 'admin_panel/dashboard.html', context)

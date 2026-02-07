from django.conf import settings
from django.shortcuts import render, get_object_or_404
from django.utils import timezone

from ciquest_model.models import Notice, Store
from ciquest_model.markdown_utils import render_markdown


def _normalize_coord(value):
    try:
        value = float(value)
    except (TypeError, ValueError):
        return None
    return value


def home(request):
    stores = (
        Store.objects.filter(status="approved")
        .prefetch_related("storetag_set__tag")
        .order_by("-created_at")
    )
    payload = []
    for store in stores:
        tags = [st.tag.name for st in store.storetag_set.all() if st.tag]
        payload.append(
            {
                "id": store.store_id,
                "name": store.name or "",
                "description": store.store_description or "",
                "lat": _normalize_coord(store.latitude),
                "lon": _normalize_coord(store.longitude),
                "tag": tags[0] if tags else "",
                "tags": tags,
            }
        )

    context = {
        "stores": payload,
        "google_maps_api_key": getattr(settings, "GOOGLE_MAPS_JS_API_KEY", ""),
    }
    return render(request, "ciquest_phone/home.html", context)


def notices(request):
    now = timezone.now()
    entries = (
        Notice.objects.filter(
            is_published=True,
            start_at__lte=now,
            end_at__gte=now,
            target__in=["all", "user"],
        )
        .order_by("-start_at", "-created_at")
    )
    for entry in entries:
        entry.body_html = render_markdown(entry.body_md)
    return render(request, "ciquest_phone/notices.html", {"notices": entries})


def store_detail(request, store_id):
    store = get_object_or_404(Store, store_id=store_id, status="approved")
    tags = [st.tag.name for st in store.storetag_set.all() if st.tag]
    context = {
        "store": store,
        "tags": tags,
    }
    return render(request, "ciquest_phone/store_detail.html", context)

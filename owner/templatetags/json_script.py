"""
Custom ``json_script`` tag shim for environments where Django's built-in
library is unavailable (e.g., trimmed Django installs).
"""
from django import template
from django.utils.html import json_script as django_json_script

register = template.Library()


@register.simple_tag
def json_script(value, element_id):
    """
    Delegate to Django's ``json_script`` helper so templates can keep using
    ``{% load json_script %}`` even if the default library can't be imported.
    """
    return django_json_script(value, element_id)


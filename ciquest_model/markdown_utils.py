from markdown import markdown


def render_markdown(text):
    if not text:
        return ""
    return markdown(text, extensions=["extra"])

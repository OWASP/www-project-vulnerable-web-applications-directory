---

layout: col-sidebar
title: VWAD - Offline List
tags: vwad
level: 3
type: documentation

---

### Offline
{% assign apps = site.data.offline | uniq %}
{% for app in apps %}
<detail>
  <summary> {{ app.name | strip }} </summary>
  URL: <a href="{{ app.url | strip }}"> {{ app.name | strip }} </a>
</detail>

{% endfor %}

---

layout: col-sidebar
title: VWAD - Offline List
tags: vwad
level: 3
type: documentation

---

### Offline

Click the triangle to the left of each entry to expand its details:

{% assign apps = site.data.offline | uniq %}
{% for app in apps %}
<details>
  <summary> {{ app.name | strip }} </summary>
  <a href="{{ app.url | strip }}"> {{ app.name | strip }} </a> <br>
  Author: {{ app.author | strip }} <br>
  Notes: {{ app.notes | strip }} <br>
  Reference(s) (if any): <br>
  {% for ref in app.references %}
    * <a href="{{ ref.url }}">{{ ref.name }}</a> <br>
  {% endfor %}
  <br>
  Technology(ies) (if known): <br>
  {% for tech in app.technology %}
    * {{ tech }} <br>
  {% endfor %}
</details>

{% endfor %}

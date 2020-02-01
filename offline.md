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
  <summary> {{ app.name }} </summary>
  <a href="{{ app.url }}"> {{ app.name }} </a> <br>
  Author: {{ app.author }} <br>
  {% if app.notes != "" and app.notes != nil %}
    Notes: {{ app.notes }} <br>
  {% endif %}
  {% if app.references != empty and app.references != nil %} 
    Reference(s) (if any): <br>
    {% for ref in app.references %}
      * <a href="{{ ref.url }}">{{ ref.name }}</a>
    {% endfor %}
  {% endif %}
  <br>
  Technology(ies) (if known): <br>
  {% for tech in app.technology %}
    * {{ tech }} <br>
  {% endfor %}
</details>

{% endfor %}

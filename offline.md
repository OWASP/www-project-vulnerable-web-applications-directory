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
  <div style="padding-left: 40px">
  <a href="{{ app.url }}"> {{ app.name }} </a> <br>
  {% if app.author != "" and app.author != nil %}
    Author: {{ app.author }} <br>
  {% endif %}
  {% if app.notes != "" and app.notes != nil %}
    Notes: {{ app.notes }} <br>
  {% endif %}
  {% if app.references != empty and app.references != nil %} 
    Reference(s): <br>
    {% for ref in app.references %}
      * <a href="{{ ref.url }}">{{ ref.name }}</a> <br>
    {% endfor %}
  {% endif %}
  {% if app.technology != empty and app.technology != nil %}
    Technology(ies): <br>
    {% for tech in app.technology %}
      * {{ tech }} <br>
    {% endfor %}
  {% endif %}
  </div>
</details>

{% endfor %}

---

layout: col-sidebar
title: VWAD - Offline List
tags: vwad
level: 3
type: documentation

---

<link href="assets/vwad.css" rel="stylesheet" type="text/css">
<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js"></script>
<script>
  $("details").click(function(event) {
    $("details").not(this).removeAttr("open");
  });
</script>

### Offline

Click the triangle to the left of each entry to expand its details:

{% assign apps = site.data.offline | uniq %}
{% for app in apps %}
<details>
  <summary> {{ app.name }} </summary>
  <div class="app-entry">
    <a href="{{ app.url }}"> {{ app.name }} </a> <br>
    {% if app.author != "" and app.author != nil %}
      Author: {{ app.author }} <br>
    {% endif %}
    {% if app.notes != "" and app.notes != nil %}
      Notes: {{ app.notes }} <br>
    {% endif %}
    {% if app.references != empty and app.references != nil %} 
      Reference(s): <br>
      <div class="app-sub-list">
        {% for ref in app.references %}
          * <a href="{{ ref.url }}">{{ ref.name }}</a> <br>
        {% endfor %}
      </div>
    {% endif %}
    {% if app.technology != empty and app.technology != nil %}
      Technology(ies): <br>
      <div class="app-sub-list">
        {% for tech in app.technology %}
          * {{ tech }} <br>
        {% endfor %}
      </div>
    {% endif %}
  </div>
</details>

{% endfor %}

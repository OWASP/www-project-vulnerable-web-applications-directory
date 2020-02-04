---

layout: col-sidebar
title: VWAD - Offline List2
tags: vwad
level: 3
type: documentation

---

<link href="assets/vwad.css" rel="stylesheet" type="text/css">

### Offline2

<table>
  <tr><th>App</th><th>URL</th><th>Author</th><th>Technology(ies)</th><th>Reference(s)</th><th>Note(s)</th></tr>
  {% assign apps = site.data.offline | uniq %}
  {% for app in apps %}
  <tr>
    <td> {{ app.name }} </td>
    <td> <a href="{{ app.url }}"> {{ app.name }} </a></td>
    <td> {{ app.author }} </td>
    <td> {% for ref in app.references %}
           * <a href="{{ ref.url }}">{{ ref.name }}</a> <br>
         {% endfor %}
    </td>
    <td> {% for tech in app.technology %}
           * {{ tech }} <br>
         {% endfor %}
    </td>
    <td> {{ app.notes }} </td>
  </tr>
  {% endfor %}
</table>

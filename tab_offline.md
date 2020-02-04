---

title: offline
displaytext: VWAD - Offline List
layout: null
order: 2
tab: true
tags: vwad

---

### Offline

<table style="font-size: 16px">
  <tr><th>App. URL</th><th>Author</th><th nowrap="nowrap">Reference(s)</th><th nowrap="nowrap">Technology(ies)</th><th nowrap="nowrap">Note(s)</th></tr>
  {% assign apps = site.data.offline | uniq %}
  {% for app in apps %}
  <tr>
    <td> <a href="{{ app.url }}"> {{ app.name }} </a></td>
    <td> {{ app.author }} </td>
    <td nowrap="nowrap">
      {% if app.references != empty and app.references != nil %}
        <ul> 
          {% for ref in app.references %}
            <li> <a href="{{ ref.url }}">{{ ref.name }}</a> </li>
          {% endfor %}
        </ul>
      {% endif %}
    </td>
    <td nowrap="nowrap"> 
      {% if app.technology != empty and app.technology != nil %}
        <ul>
          {% for tech in app.technology %}
            <li> {{ tech }} </li>
          {% endfor %}
        </ul>
      {% endif %}
    </td>
    <td> {{ app.notes }} </td>
  </tr>
  {% endfor %}
</table>

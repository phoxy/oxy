<div>

{{ for (i = 0; i < 100; i++){ }}
  {{+ `home/index`, {i} }}
{{ } }}

</div>
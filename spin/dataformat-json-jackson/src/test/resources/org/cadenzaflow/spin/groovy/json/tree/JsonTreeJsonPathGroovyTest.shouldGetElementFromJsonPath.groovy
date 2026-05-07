package org.cadenzaflow.spin.groovy.json.tree

jsonNode = S(input, "application/json");

node = jsonNode.jsonPath('$.orderDetails').element();
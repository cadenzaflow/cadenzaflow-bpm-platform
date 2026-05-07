package org.cadenzaflow.spin.groovy.json.tree

jsonNode = S(input, "application/json");

jsonNode.jsonPath('$.order').boolValue();
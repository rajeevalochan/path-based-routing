# Path-Based Routing

One public site served from two Adobe platforms. Requests are split by path: some sections are served by AEM Publish and everything else by AEM Edge Delivery Services (EDS).

## Language

### Hosts

**Public Host**:
The single hostname visitors use. Visitors never see an Origin's own hostname.
_Avoid_: domain, site URL, front door

**Origin**:
A backend platform that actually serves the content for a request. There are exactly two.
_Avoid_: backend, upstream, target, URL A / URL B

**Publish Origin**:
The Origin that represents AEM Publish (AEM as a Cloud Service publish tier).
_Avoid_: AEM, author, URL A

**EDS Origin**:
The Origin that represents AEM Edge Delivery Services. It serves every request that no Publish Path claims.
_Avoid_: Default Origin, fallback origin, Franklin, Helix, URL B

### Routing

**Publish Path**:
Any path the Publish Origin claims. It is either a Route Rule or a Publish Asset Path.
_Avoid_: Publish route, AEM path

**Route Rule**:
A configured path prefix whose requests belong to the Publish Origin. It covers a business section of the site.
_Avoid_: route, mapping, redirect rule

**Publish Asset Path**:
A built-in path prefix where the Publish Origin serves supporting files (styles, scripts, images) that Publish pages need.
_Avoid_: static path, clientlib path

**Reserved EDS Path**:
A path the EDS Origin depends on for its own pages to work. No Route Rule may claim it.
_Avoid_: EDS asset path, protected path

**Shadowing**:
When a Route Rule claims a Reserved EDS Path prefix, so requests that should reach the EDS Origin reach the Publish Origin instead.
_Avoid_: overlap, collision, conflict

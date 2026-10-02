import re
from dataclasses import dataclass, field
from functools import lru_cache

from tree_sitter import Language, Parser
import tree_sitter_javascript


# ============================================================
# Tree-sitter setup
# ============================================================

JS_LANGUAGE = Language(
    tree_sitter_javascript.language()
)


# ============================================================
# Security-relevant sources
# ============================================================

SENSITIVE_SOURCES = {
    "document.cookie": "browser_cookie",
    "chrome.cookies": "browser_cookie",
    "browser.cookies": "browser_cookie",

    "document.location": "page_location",
    "window.location": "page_location",

    "localStorage": "local_storage",
    "sessionStorage": "session_storage",
}


# ============================================================
# Network sinks
# ============================================================

NETWORK_SINKS = {
    "fetch",
    "XMLHttpRequest",
    "navigator.sendBeacon",
    "WebSocket",
}


# ============================================================
# Large-bundle analysis limits and graph helpers
# ============================================================

# These are computational safety limits only. They do not assign
# security scores or decide whether an extension is malicious.
MAX_REACHABLE_NODES = 5000
MAX_LARGE_BUNDLE_REACHABLE_NODES = 2500
LARGE_BUNDLE_SIZE_BYTES = 1_500_000


def _identifier_names(expression):
    """Extract JavaScript identifier-like names from an expression."""

    if not expression:
        return set()

    return set(
        re.findall(
            r"[A-Za-z_$][A-Za-z0-9_$]*",
            expression
        )
    )


def _build_flow_graph(flows):
    """Build a forward graph from flow records."""

    graph = {}

    for flow in flows or []:
        source = flow.get("from")
        target = flow.get("to")

        if not source or not target:
            continue

        graph.setdefault(source, set()).add(target)

    return graph


def _reachable_from(graph, start, max_nodes=MAX_REACHABLE_NODES):
    """
    Find nodes reachable from one source using bounded BFS.

    The previous implementation built a transitive closure for the entire
    bundle. That is expensive for minified React/framework bundles because
    unrelated variables can create a very large graph. Source-directed BFS
    computes only the reachability needed for security correlation.
    """

    if not start:
        return set()

    reachable = set()
    queue = list(graph.get(start, set()))
    position = 0

    while position < len(queue):
        current = queue[position]
        position += 1

        if current == start or current in reachable:
            continue

        reachable.add(current)

        if len(reachable) >= max_nodes:
            break

        for target in graph.get(current, set()):
            if target not in reachable:
                queue.append(target)

    return reachable


# ============================================================
# Transformations
# ============================================================

TRANSFORMATIONS = {
    "atob": "decode",
    "btoa": "encode",
    "encodeURIComponent": "encode",
    "decodeURIComponent": "decode",
    "JSON.stringify": "serialize",
    "JSON.parse": "parse",
}


# ============================================================
# Data structures
# ============================================================

@dataclass
class InterproceduralFlow:
    source_variable: str
    argument_variable: str
    parameter_variable: str

    caller_function: str
    callee_function: str

    file: str
    line: int


@dataclass
class FunctionInfo:
    name: str
    parameters: list[str] = field(default_factory=list)
    line: int = 0
    end_line: int = 0


@dataclass
class ReturnInfo:
    function: str
    expression: str
    file: str
    line: int


# ============================================================
# Generic helpers
# ============================================================

def normalize_expression(expression):
    """
    Normalize a JavaScript expression.
    """

    if expression is None:
        return ""

    expression = expression.strip()

    while (
        expression.startswith("(")
        and expression.endswith(")")
    ):
        expression = expression[1:-1].strip()

    return expression


def expression_contains_variable(
    expression,
    variable
):
    """
    Determine whether an expression contains a variable.
    """

    if not expression or not variable:
        return False

    expression = normalize_expression(
        expression
    )

    variable = normalize_expression(
        variable
    )

    pattern = rf"\b{re.escape(variable)}\b"

    return re.search(
        pattern,
        expression
    ) is not None


def get_node_text(
    node,
    source_code
):
    """
    Return exact source text represented by
    a Tree-sitter node.
    """

    return source_code[
        node.start_byte:node.end_byte
    ]


def get_callable_name(
    node,
    source_code
):
    """
    Extract a readable callable name.
    """

    if node is None:
        return ""

    if node.type == "identifier":
        return get_node_text(
            node,
            source_code
        )

    if node.type == "member_expression":
        return get_node_text(
            node,
            source_code
        )

    return get_node_text(
        node,
        source_code
    )


def extract_call_arguments(
    node,
    source_code
):
    """
    Extract all arguments from a call expression.
    """

    arguments_node = node.child_by_field_name(
        "arguments"
    )

    if arguments_node is None:
        return []

    arguments = []

    for child in arguments_node.named_children:

        arguments.append(
            get_node_text(
                child,
                source_code
            )
        )

    return arguments


def walk_tree(node):
    """
    Recursively yield every Tree-sitter node.
    """

    yield node

    for child in node.named_children:
        yield from walk_tree(child)


# ============================================================
# Source detection
# ============================================================

def find_matching_source(expression):
    """
    Identify a security-relevant source in an expression.
    """

    if not expression:
        return None

    normalized = normalize_expression(
        expression
    )

    sources = sorted(
        SENSITIVE_SOURCES.items(),
        key=lambda item: len(item[0]),
        reverse=True
    )

    for source_name, source_type in sources:

        if expression_contains_variable(
            normalized,
            source_name
        ):

            return {
                "source": source_name,
                "source_type": source_type,
            }

    return None


# ============================================================
# Browser-extension API source model
# ============================================================

# These APIs are modeled as *data sources*, not as malicious behavior.
# A finding is created only when data originating from one of these
# sources can be followed to a network sink.
EXTENSION_API_SOURCES = {
    "chrome.cookies.get": {
        "source": "chrome.cookies",
        "source_type": "browser_cookie",
        "callback": "last",
    },
    "chrome.cookies.getAll": {
        "source": "chrome.cookies",
        "source_type": "browser_cookie",
        "callback": "last",
    },
    "browser.cookies.get": {
        "source": "browser.cookies",
        "source_type": "browser_cookie",
        "callback": "last",
    },
    "browser.cookies.getAll": {
        "source": "browser.cookies",
        "source_type": "browser_cookie",
        "callback": "last",
    },
    "chrome.storage.local.get": {
        "source": "chrome.storage.local",
        "source_type": "extension_storage",
        "callback": "last",
    },
    "chrome.storage.sync.get": {
        "source": "chrome.storage.sync",
        "source_type": "extension_storage",
        "callback": "last",
    },
    "chrome.storage.session.get": {
        "source": "chrome.storage.session",
        "source_type": "extension_storage",
        "callback": "last",
    },
    "chrome.tabs.query": {
        "source": "chrome.tabs",
        "source_type": "tab_information",
        "callback": "last",
    },
    "chrome.webRequest.onBeforeRequest.addListener": {
        "source": "chrome.webRequest",
        "source_type": "network_request_information",
        "callback": 0,
    },
    "chrome.webRequest.onBeforeSendHeaders.addListener": {
        "source": "chrome.webRequest",
        "source_type": "network_request_information",
        "callback": 0,
    },
    "chrome.webRequest.onHeadersReceived.addListener": {
        "source": "chrome.webRequest",
        "source_type": "network_request_information",
        "callback": 0,
    },
    "chrome.runtime.onMessage.addListener": {
        "source": "chrome.runtime.onMessage",
        "source_type": "extension_message",
        "callback": 0,
    },
    "browser.runtime.onMessage.addListener": {
        "source": "browser.runtime.onMessage",
        "source_type": "extension_message",
        "callback": 0,
    },
}


def _extension_callback_parameters(callback_node, source_code):
    """Return parameter names from a JavaScript callback node."""
    if callback_node is None:
        return []

    parameter_node = callback_node.child_by_field_name("parameters")

    # Some Tree-sitter JavaScript versions expose a single arrow
    # parameter differently, so support both representations.
    if parameter_node is None:
        parameter_node = callback_node.child_by_field_name("parameter")

    if parameter_node is None:
        return []

    names = []

    def collect(node):
        if node.type == "identifier":
            value = get_node_text(node, source_code).strip()
            if value and value not in names:
                names.append(value)
            return

        # Destructuring parameters are intentionally supported.  The
        # identifiers become source carriers for subsequent property use.
        for child in node.named_children:
            collect(child)

    if parameter_node.type == "identifier":
        collect(parameter_node)
    else:
        for child in parameter_node.named_children:
            collect(child)

    return names


def _extension_callback_argument(call_node, api_info, source_code):
    """Locate the callback function argument for a known extension API."""
    arguments_node = call_node.child_by_field_name("arguments")
    if arguments_node is None:
        return None

    args = list(arguments_node.named_children)
    if not args:
        return None

    selector = api_info.get("callback")
    if selector == "last":
        index = len(args) - 1
    elif isinstance(selector, int):
        index = selector
    else:
        return None

    if index < 0 or index >= len(args):
        return None

    candidate = args[index]
    if candidate.type not in ("function", "arrow_function"):
        return None

    return candidate


def find_extension_api_sources(program_model, source_code):
    """Model values supplied by browser-extension APIs as taint sources.

    This function deliberately does not report an API call by itself.
    It only creates source observations for callback parameters.  The
    existing data-flow engine then decides whether those values reach a
    network sink.
    """
    observations = []

    if not source_code:
        return observations

    try:
        parser = Parser(JS_LANGUAGE)
        tree = parser.parse(source_code.encode("utf-8"))
    except Exception:
        return observations

    seen = set()

    for node in walk_tree(tree.root_node):
        if node.type != "call_expression":
            continue

        function_node = node.child_by_field_name("function")
        callable_name = get_callable_name(function_node, source_code)
        api_info = EXTENSION_API_SOURCES.get(callable_name)

        if api_info is None:
            continue

        callback = _extension_callback_argument(
            node,
            api_info,
            source_code,
        )

        if callback is None:
            continue

        parameters = _extension_callback_parameters(
            callback,
            source_code,
        )

        for parameter in parameters:
            key = (
                api_info["source"],
                api_info["source_type"],
                program_model.file,
                callback.start_point[0] + 1,
                parameter,
            )

            if key in seen:
                continue

            seen.add(key)

            observations.append(
                {
                    "source": api_info["source"],
                    "source_type": api_info["source_type"],
                    "file": program_model.file,
                    "line": callback.start_point[0] + 1,
                    "column": callback.start_point[1],
                    "variable": parameter,
                    "origin": "extension_api",
                    "api": callable_name,
                }
            )

    # --------------------------------------------------------
    # Fallback for callback arguments represented by the
    # ProgramModel as source-code strings. This is important for
    # extension API calls whose callback body is nested inside a
    # call expression. The AST program model already preserves
    # those callback arguments, so we can safely recover simple
    # function parameters without guessing data flow.
    # --------------------------------------------------------

    callback_pattern = re.compile(
        r"(?:function\s*\(([^)]*)\)|\(([^)]*)\)\s*=>|([A-Za-z_$][\w$]*)\s*=>)"
    )

    for call in getattr(
        program_model,
        "function_calls",
        []
    ):
        api_info = EXTENSION_API_SOURCES.get(call.name)

        if api_info is None:
            continue

        arguments = list(call.arguments or [])

        if not arguments:
            continue

        # Use the normalized extension-API callback selector.
        # Older versions of this fallback only understood the
        # legacy ``callback_index`` key, which caused webRequest
        # listeners (whose callback is argument 0) to be skipped.
        callback_selector = api_info.get(
            "callback_index",
            api_info.get("callback", "last")
        )

        if callback_selector == "last" or callback_selector == -1:
            callback_index = len(arguments) - 1
        elif isinstance(callback_selector, int):
            callback_index = callback_selector
        else:
            callback_index = len(arguments) - 1

        if (
            callback_index < 0
            or callback_index >= len(arguments)
        ):
            continue

        callback_text = arguments[callback_index]

        match = callback_pattern.search(
            callback_text
        )

        if not match:
            continue

        parameter_text = next(
            (group for group in match.groups() if group is not None),
            "",
        )

        parameters = [
            parameter.strip()
            for parameter in parameter_text.split(",")
            if parameter.strip()
        ]

        for parameter_index, parameter in enumerate(parameters):
            key = (
                api_info["source"],
                api_info["source_type"],
                call.file,
                call.line,
                parameter,
            )

            if key in seen:
                continue

            seen.add(key)

            observations.append(
                {
                    "source": api_info["source"],
                    "source_type": api_info["source_type"],
                    "file": call.file,
                    "line": call.line,
                    "column": call.column,
                    "variable": parameter,
                    "origin": "extension_api",
                    "api": call.name,
                    "callback_parameter": parameter,
                    "callback_parameter_index": parameter_index,
                }
            )

    return observations


# ============================================================
# Transformation detection
# ============================================================

def find_transformation(expression):
    """
    Identify a known transformation.
    """

    if not expression:
        return None

    for name, transformation_type in (
        TRANSFORMATIONS.items()
    ):

        pattern = (
            rf"\b{re.escape(name)}\s*\("
        )

        if re.search(
            pattern,
            expression
        ):

            return {
                "name": name,
                "type": transformation_type,
            }

    return None


# ============================================================
# Network sink detection
# ============================================================

def find_network_sink(expression):
    """
    Identify a network operation.
    """

    if not expression:
        return None

    for sink in NETWORK_SINKS:

        if sink == "navigator.sendBeacon":

            if "navigator.sendBeacon" in expression:
                return sink

        else:

            pattern = (
                rf"\b{re.escape(sink)}\s*\("
            )

            if re.search(
                pattern,
                expression
            ):

                return sink

    return None


# ============================================================
# URL detection
# ============================================================

def extract_url(expression):
    """
    Extract the first HTTP/HTTPS URL.
    """

    if not expression:
        return None

    match = re.search(
        r'https?://[^\s"\']+',
        expression
    )

    if match:
        return match.group(0)

    return None


# ============================================================
# Function extraction
# ============================================================

def extract_functions(source_code):
    """
    Extract user-defined JavaScript functions.
    """

    parser = Parser(JS_LANGUAGE)

    tree = parser.parse(
        source_code.encode("utf-8")
    )

    functions = {}

    for node in walk_tree(
        tree.root_node
    ):

        if node.type not in {"function", "function_declaration"}:
            continue

        name_node = node.child_by_field_name(
            "name"
        )

        parameters_node = node.child_by_field_name(
            "parameters"
        )

        body_node = node.child_by_field_name(
            "body"
        )

        if name_node is None:
            continue

        name = get_node_text(
            name_node,
            source_code
        )

        parameters = []

        if parameters_node is not None:

            for parameter in (
                parameters_node.named_children
            ):

                parameters.append(
                    get_node_text(
                        parameter,
                        source_code
                    )
                )

        end_line = (
            body_node.end_point[0] + 1
            if body_node is not None
            else node.end_point[0] + 1
        )

        functions[name] = FunctionInfo(
            name=name,
            parameters=parameters,
            line=node.start_point[0] + 1,
            end_line=end_line,
        )

    return tree, functions


# ============================================================
# Return statement extraction
# ============================================================

def extract_function_returns(
    tree,
    source_code
):
    """
    Extract return statements from user-defined functions.

    Example:

        function getData() {
            return document.cookie;
        }

    becomes:

        getData -> document.cookie
    """

    returns = []

    for node in walk_tree(
        tree.root_node
    ):

        if node.type not in {"function", "function_declaration"}:
            continue

        name_node = node.child_by_field_name(
            "name"
        )

        body_node = node.child_by_field_name(
            "body"
        )

        if (
            name_node is None
            or body_node is None
        ):
            continue

        function_name = get_node_text(
            name_node,
            source_code
        )

        for child in walk_tree(
            body_node
        ):

            if child.type != "return_statement":
                continue

            expression_node = (
                child.child_by_field_name(
                    "argument"
                )
            )

            if expression_node is None:
                named_children = child.named_children
                if named_children:
                    expression_node = named_children[0]

            if expression_node is None:
                continue

            expression = get_node_text(
                expression_node,
                source_code
            ).strip()

            if not expression:
                continue

            returns.append(
                ReturnInfo(
                    function=function_name,
                    expression=expression,
                    file="",
                    line=child.start_point[0] + 1,
                )
            )

    return returns


# ============================================================
# Function call extraction
# ============================================================

def extract_function_calls(
    tree,
    source_code
):
    """
    Extract all JavaScript call expressions.
    """

    calls = []

    for node in walk_tree(
        tree.root_node
    ):

        if node.type != "call_expression":
            continue

        function_node = node.child_by_field_name(
            "function"
        )

        if function_node is None:
            continue

        name = get_callable_name(
            function_node,
            source_code
        )

        arguments = extract_call_arguments(
            node,
            source_code
        )

        calls.append(
            {
                "name":
                    name,

                "arguments":
                    arguments,

                "line":
                    node.start_point[0] + 1,

                "column":
                    node.start_point[1],

                "node":
                    node,
            }
        )

    return calls


# ============================================================
# Security source analysis
# ============================================================

def find_sources(program_model):
    """
    Identify security-relevant sources in both direct assignments
    and function return values.

    Direct example:

        const cookieData = document.cookie;

    Indirect example:

        function getData() {
            return document.cookie;
        }

        const cookieData = getData();

    Both cases produce a source observation associated with
    the variable that receives the sensitive value.
    """

    observations = []
    seen = set()

    # --------------------------------------------------------
    # Direct source assignments
    # --------------------------------------------------------

    for assignment in program_model.variable_assignments:

        source_info = find_matching_source(
            assignment.value
        )

        if source_info is None:
            continue

        key = (
            source_info["source"],
            assignment.file,
            assignment.line,
            assignment.variable
        )

        if key in seen:
            continue

        seen.add(key)

        observations.append(
            {
                "source":
                    source_info["source"],

                "source_type":
                    source_info["source_type"],

                "file":
                    assignment.file,

                "line":
                    assignment.line,

                "column":
                    assignment.column,

                "variable":
                    assignment.variable,
            }
        )

    # --------------------------------------------------------
    # Function-return sources
    #
    # A sensitive source may occur inside a return statement
    # rather than directly inside a variable assignment.
    #
    # Example:
    #
    #     function getData() {
    #         return document.cookie;
    #     }
    #
    #     const cookieData = getData();
    #
    # The receiving variable is cookieData.
    # --------------------------------------------------------

    try:

        with open(
            program_model.file,
            "r",
            encoding="utf-8",
            errors="ignore"
        ) as file:

            source_code = file.read()

    except OSError:

        source_code = ""

    if source_code:

        parser = Parser(JS_LANGUAGE)

        tree = parser.parse(
            source_code.encode("utf-8")
        )

        returns = extract_function_returns(
            tree,
            source_code
        )

        function_returns = {}

        for return_info in returns:

            function_returns.setdefault(
                return_info.function,
                []
            ).append(
                return_info
            )

        # ----------------------------------------------------
        # Match assignments receiving a function return.
        # ----------------------------------------------------

        for assignment in (
            program_model.variable_assignments
        ):

            value = normalize_expression(
                assignment.value
            )

            for function_name in function_returns:

                pattern = (
                    rf"\b{re.escape(function_name)}\s*\("
                )

                if not re.search(
                    pattern,
                    value
                ):
                    continue

                for return_info in (
                    function_returns[
                        function_name
                    ]
                ):

                    source_info = find_matching_source(
                        return_info.expression
                    )

                    if source_info is None:
                        continue

                    key = (
                        source_info["source"],
                        assignment.file,
                        return_info.line,
                        assignment.variable
                    )

                    if key in seen:
                        continue

                    seen.add(key)

                    observations.append(
                        {
                            "source":
                                source_info["source"],

                            "source_type":
                                source_info["source_type"],

                            "file":
                                assignment.file,

                            "line":
                                return_info.line,

                            "column":
                                assignment.column,

                            "variable":
                                assignment.variable,

                            "origin":
                                "function_return",

                            "function":
                                function_name,

                            "return_line":
                                return_info.line,
                        }
                    )

    # --------------------------------------------------------
    # Browser-extension API callback sources
    # --------------------------------------------------------

    if source_code:

        api_sources = find_extension_api_sources(
            program_model,
            source_code
        )

        for observation in api_sources:

            key = (
                observation["source"],
                observation["file"],
                observation["line"],
                observation["variable"]
            )

            if key in seen:
                continue

            seen.add(key)
            observations.append(observation)

    return observations


# ============================================================
# Direct variable flow
# ============================================================

def build_variable_flow(
    program_model
):
    """
    Build direct source-to-variable and
    variable-to-variable relationships.
    """

    flows = []

    sources = find_sources(
        program_model
    )

    known_variables = set()

    # --------------------------------------------------------
    # Source -> variable
    # --------------------------------------------------------

    for source in sources:

        known_variables.add(
            source["variable"]
        )

        flows.append(
            {
                "from":
                    source["source"],

                "to":
                    source["variable"],

                "type":
                    "source_to_variable",

                "file":
                    source["file"],

                "line":
                    source["line"],
            }
        )

    # --------------------------------------------------------
    # Variable -> variable
    # --------------------------------------------------------

    changed = True

    while changed:

        changed = False

        for assignment in (
            program_model.variable_assignments
        ):

            variable = assignment.variable

            value = normalize_expression(
                assignment.value
            )

            if variable in known_variables:
                continue

            for known_variable in list(
                known_variables
            ):

                if expression_contains_variable(
                    value,
                    known_variable
                ):

                    flows.append(
                        {
                            "from":
                                known_variable,

                            "to":
                                variable,

                            "type":
                                "variable_to_variable",

                            "file":
                                assignment.file,

                            "line":
                                assignment.line,
                        }
                    )

                    known_variables.add(
                        variable
                    )

                    changed = True

                    break

    return flows


# ============================================================
# Return-value propagation
# ============================================================

def build_return_value_flows(
    program_model,
    source_code
):
    """
    Resolve function return values into variables.

    Example:

        function getData() {
            return document.cookie;
        }

        const cookieData = getData();

    becomes:

        document.cookie -> cookieData
    """

    parser = Parser(JS_LANGUAGE)

    tree = parser.parse(
        source_code.encode("utf-8")
    )

    _, functions = extract_functions(
        source_code
    )

    returns = extract_function_returns(
        tree,
        source_code
    )

    flows = []

    # --------------------------------------------------------
    # Map function -> return expressions.
    # --------------------------------------------------------

    function_returns = {}

    for return_info in returns:

        function_returns.setdefault(
            return_info.function,
            []
        ).append(
            return_info
        )

    # --------------------------------------------------------
    # Find assignments receiving function returns.
    # --------------------------------------------------------

    for assignment in (
        program_model.variable_assignments
    ):

        value = normalize_expression(
            assignment.value
        )

        for function_name in functions:

            pattern = (
                rf"\b{re.escape(function_name)}\s*\("
            )

            if not re.search(
                pattern,
                value
            ):
                continue

            if function_name not in function_returns:
                continue

            for return_info in (
                function_returns[
                    function_name
                ]
            ):

                return_expression = (
                    normalize_expression(
                        return_info.expression
                    )
                )

                # --------------------------------------------
                # Direct sensitive source return.
                # --------------------------------------------

                source_info = find_matching_source(
                    return_expression
                )

                if source_info is not None:

                    flows.append(
                        {
                            "from":
                                source_info["source"],

                            "to":
                                assignment.variable,

                            "type":
                                "function_return_to_variable",

                            "function":
                                function_name,

                            "file":
                                assignment.file,

                            "line":
                                assignment.line,

                            "return_line":
                                return_info.line,
                        }
                    )

                    continue

                # --------------------------------------------
                # Return of an existing variable.
                # --------------------------------------------

                for existing_assignment in (
                    program_model.variable_assignments
                ):

                    if (
                        existing_assignment.variable
                        == return_expression
                    ):

                        flows.append(
                            {
                                "from":
                                    existing_assignment.variable,

                                "to":
                                    assignment.variable,

                                "type":
                                    "function_return_to_variable",

                                "function":
                                    function_name,

                                "file":
                                    assignment.file,

                                "line":
                                    assignment.line,

                                "return_line":
                                    return_info.line,
                            }
                        )

    return flows


# ============================================================
# Interprocedural argument -> parameter flow
# ============================================================

def build_interprocedural_flows(
    program_model,
    source_code
):
    """
    Build argument-to-parameter and function return-value relationships.

    Uses an indexed worklist instead of repeatedly comparing every call
    against every derived variable. This is substantially cheaper on large
    bundled JavaScript while preserving the existing flow model.
    """

    tree, functions = extract_functions(
        source_code
    )

    calls = extract_function_calls(
        tree,
        source_code
    )

    direct_flows = build_variable_flow(
        program_model
    )

    returns = extract_function_returns(
        tree,
        source_code
    )

    return_flows = build_return_value_flows(
        program_model,
        source_code
    )

    derived_variables = set()

    for source in find_sources(
        program_model
    ):
        derived_variables.add(
            source["variable"]
        )

    for flow in direct_flows:
        if flow.get("type") == "variable_to_variable":
            derived_variables.add(
                flow["to"]
            )

    for flow in return_flows:
        derived_variables.add(
            flow["to"]
        )

    # Index each call argument by the identifiers it contains.
    # Security-relevant propagation then visits only calls that can
    # actually consume a currently derived variable.
    indexed_calls = {}

    for call in calls:
        callee_name = call.get("name")

        if callee_name not in functions:
            continue

        parameters = functions[
            callee_name
        ].parameters

        arguments = call.get(
            "arguments",
            []
        )

        for index, argument in enumerate(arguments):
            if index >= len(parameters):
                continue

            parameter = parameters[index]

            for identifier in _identifier_names(argument):
                indexed_calls.setdefault(
                    identifier,
                    []
                ).append(
                    (call, parameter, callee_name)
                )

    interprocedural_flows = []
    seen_flows = set()
    queue = list(derived_variables)
    position = 0

    while position < len(queue):
        derived_variable = queue[position]
        position += 1

        for call, parameter, callee_name in indexed_calls.get(
            derived_variable,
            []
        ):
            flow = {
                "from": derived_variable,
                "to": parameter,
                "type": "argument_to_parameter",
                "caller": "<unknown>",
                "callee": callee_name,
                "file": program_model.file,
                "line": call.get("line"),
            }

            key = (
                flow["from"],
                flow["to"],
                flow["callee"],
                flow["line"],
            )

            if key in seen_flows:
                continue

            seen_flows.add(key)
            interprocedural_flows.append(
                flow
            )

            if parameter not in derived_variables:
                derived_variables.add(
                    parameter
                )
                queue.append(
                    parameter
                )

    for flow in return_flows:
        return_flow = {
            "from": flow["from"],
            "to": flow["to"],
            "type": flow["type"],
            "callee": flow["function"],
            "file": flow["file"],
            "line": flow["line"],
            "return_line": flow["return_line"],
        }

        if return_flow not in interprocedural_flows:
            interprocedural_flows.append(
                return_flow
            )

    return {
        "flows": interprocedural_flows,
        "functions": functions,
        "calls": calls,
        "returns": returns,
        "return_flows": return_flows,
        "derived_variables": derived_variables,
    }

# ============================================================
# Parameter -> parameter propagation
# ============================================================

def build_parameter_to_parameter_flows(
    source_code,
    functions,
    calls,
    derived_parameters
):
    """Detect parameter-to-parameter propagation with indexed calls."""

    flows = []
    known_parameters = set(
        derived_parameters or set()
    )

    if not known_parameters:
        return flows

    indexed_calls = {}

    for call in calls:
        callee_name = call.get("name")

        if callee_name not in functions:
            continue

        parameters = functions[
            callee_name
        ].parameters

        arguments = call.get(
            "arguments",
            []
        )

        for index, argument in enumerate(arguments):
            if index >= len(parameters):
                continue

            parameter = parameters[index]

            for identifier in _identifier_names(argument):
                indexed_calls.setdefault(
                    identifier,
                    []
                ).append(
                    (call, parameter, callee_name)
                )

    queue = list(known_parameters)
    position = 0

    while position < len(queue):
        known_parameter = queue[position]
        position += 1

        for call, parameter, callee_name in indexed_calls.get(
            known_parameter,
            []
        ):
            if parameter in known_parameters:
                continue

            flows.append({
                "from": known_parameter,
                "to": parameter,
                "type": "parameter_to_parameter",
                "callee": callee_name,
                "line": call.get("line"),
            })

            known_parameters.add(
                parameter
            )
            queue.append(
                parameter
            )

    return flows

# ============================================================
# Parameter -> network sink
# ============================================================

@lru_cache(maxsize=64)
def _find_function_sink_usages(source_code, function_name):
    """Return network-sink calls found inside one named function.

    Real browser extensions frequently contain large bundled JavaScript.
    The previous implementation reparsed and walked the entire source file
    once for *every* function parameter.  That made large bundles extremely
    expensive to analyze and could appear to hang.  Cache the parsed result
    per (source_code, function_name) instead.
    """
    if not source_code or not function_name:
        return []

    parser = Parser(JS_LANGUAGE)
    tree = parser.parse(source_code.encode("utf-8"))
    results = []

    for node in walk_tree(tree.root_node):
        if node.type not in {"function", "function_declaration"}:
            continue

        name_node = node.child_by_field_name("name")
        if name_node is None:
            continue

        current_name = get_node_text(name_node, source_code)
        if current_name != function_name:
            continue

        body_node = node.child_by_field_name("body")
        if body_node is None:
            continue

        for child in walk_tree(body_node):
            if child.type != "call_expression":
                continue

            function_node = child.child_by_field_name("function")
            if function_node is None:
                continue

            sink_name = get_callable_name(function_node, source_code)
            sink = find_network_sink(f"{sink_name}(")
            if sink is None:
                continue

            call_text = get_node_text(child, source_code)
            results.append({
                "sink": sink,
                "line": child.start_point[0] + 1,
                "destination": extract_url(call_text),
                "expression": call_text,
                "function": function_name,
            })

    return results


def find_parameter_sink_usage(
    source_code,
    function_info,
    parameter
):
    """Determine whether a function parameter reaches a network sink."""
    results = []

    for usage in _find_function_sink_usages(
        source_code,
        function_info.name
    ):
        if not expression_contains_variable(
            usage["expression"],
            parameter
        ):
            continue

        result = dict(usage)
        result["parameter"] = parameter
        results.append(result)

    return results


# ============================================================
# Transformations
# ============================================================

def analyze_transformations(
    program_model,
    derived_variables=None
):
    """
    Identify transformations relevant to derived data.
    """

    transformations = []

    if derived_variables is None:
        derived_variables = set()

    for assignment in (
        program_model.variable_assignments
    ):

        transformation = find_transformation(
            assignment.value
        )

        if transformation is None:
            continue

        if derived_variables:

            relevant = any(
                expression_contains_variable(
                    assignment.value,
                    variable
                )
                for variable in derived_variables
            )

            if not relevant:
                continue

        transformations.append(
            {
                "name":
                    transformation["name"],

                "type":
                    transformation["type"],

                "expression":
                    assignment.value,

                "file":
                    assignment.file,

                "line":
                    assignment.line,

                "column":
                    assignment.column,
            }
        )

    for call in program_model.function_calls:

        if call.name not in TRANSFORMATIONS:
            continue

        expression = (
            f"{call.name}("
            + ", ".join(call.arguments)
            + ")"
        )

        if derived_variables:

            relevant = any(
                expression_contains_variable(
                    expression,
                    variable
                )
                for variable in derived_variables
            )

            if not relevant:
                continue

        transformations.append(
            {
                "name":
                    call.name,

                "type":
                    TRANSFORMATIONS[
                        call.name
                    ],

                "expression":
                    expression,

                "file":
                    call.file,

                "line":
                    call.line,

                "column":
                    call.column,
            }
        )

    unique = []

    seen = set()

    for transformation in transformations:

        key = (
            transformation["name"],
            transformation["file"],
            transformation["line"],
            transformation["expression"],
        )

        if key in seen:
            continue

        seen.add(
            key
        )

        unique.append(
            transformation
        )

    return unique


# ============================================================
# Network operations
# ============================================================

def analyze_network_sinks(
    program_model
):
    """
    Identify network operations, including object-based send APIs.

    Supported forms include:

        fetch(url, options)
        navigator.sendBeacon(url, data)
        xhr.send(data)
        socket.send(data)

    XMLHttpRequest and WebSocket constructors are tracked so that their
    instance methods can be interpreted as network sinks.
    """

    operations = []

    xhr_variables = set()
    websocket_variables = set()

    for assignment in getattr(
        program_model,
        "variable_assignments",
        []
    ):
        value = assignment.value or ""

        if re.search(
            r"\bnew\s+XMLHttpRequest\s*\(",
            value
        ):
            xhr_variables.add(assignment.variable)

        if re.search(
            r"\bnew\s+WebSocket\s*\(",
            value
        ):
            websocket_variables.add(assignment.variable)

    for call in program_model.function_calls:

        sink = find_network_sink(
            f"{call.name}("
        )

        if sink is None:
            # Tree-sitter represents xhr.send() and socket.send()
            # as member calls. Treat .send() as a sink only when the
            # receiver is known to be an XMLHttpRequest/WebSocket.
            if call.name.endswith(".send"):
                receiver = call.name.rsplit(".", 1)[0]

                if receiver in xhr_variables:
                    sink = "XMLHttpRequest.send"

                elif receiver in websocket_variables:
                    sink = "WebSocket.send"

        if sink is None:
            continue

        expression = (
            f"{call.name}("
            + ", ".join(call.arguments)
            + ")"
        )

        destination = extract_url(
            expression
        )

        # For xhr.send()/socket.send(), the destination is normally
        # established by a preceding constructor/open call. Recover it
        # from the program model when possible.
        if destination is None and call.name.endswith(".send"):
            receiver = call.name.rsplit(".", 1)[0]

            for earlier_call in program_model.function_calls:
                if earlier_call.name != f"{receiver}.open":
                    continue

                earlier_expression = (
                    f"{earlier_call.name}("
                    + ", ".join(earlier_call.arguments)
                    + ")"
                )
                destination = extract_url(
                    earlier_expression
                )
                if destination:
                    break

            if destination is None:
                for assignment in program_model.variable_assignments:
                    if assignment.variable != receiver:
                        continue

                    destination = extract_url(
                        assignment.value or ""
                    )
                    if destination:
                        break

        operations.append(
            {
                "sink": sink,
                "file": call.file,
                "line": call.line,
                "column": call.column,
                "destination": destination,
                "arguments": call.arguments,
            }
        )

    return operations


# ============================================================
# Direct source -> sink correlation
# ============================================================

def correlate_sources_and_sinks(
    program_model,
    sources,
    variable_flows,
    transformations,
    network_operations
):
    """Establish direct source-to-network relationships."""

    findings = []
    graph = _build_flow_graph(
        variable_flows
    )

    for source in sources:
        source_variable = source[
            "variable"
        ]

        reachable = _reachable_from(
            graph,
            source_variable
        )

        for operation in network_operations:
            sink_expression = " ".join(
                operation.get(
                    "arguments",
                    []
                )
            )

            sink_reached = (
                expression_contains_variable(
                    sink_expression,
                    source_variable
                )
                or any(
                    expression_contains_variable(
                        sink_expression,
                        variable
                    )
                    for variable in reachable
                )
            )

            if not sink_reached:
                continue

            relevant_transformations = []

            for transformation in transformations:
                if any(
                    expression_contains_variable(
                        transformation["expression"],
                        variable
                    )
                    for variable in reachable
                ):
                    relevant_transformations.append(
                        transformation
                    )

            findings.append({
                "type": "potential_sensitive_data_flow",
                "source": source["source"],
                "source_type": source["source_type"],
                "variable": source_variable,
                "file": source["file"],
                "source_line": source["line"],
                "sink": operation["sink"],
                "sink_line": operation["line"],
                "destination": operation["destination"],
                "transformations": relevant_transformations,
                "flow_type": "direct",
                "source_reachable_variables": sorted(
                    reachable
                ),
            })

    return findings

# ============================================================
# Interprocedural source -> sink correlation
# ============================================================

def correlate_interprocedural_flows(
    program_model,
    sources,
    variable_flows,
    interprocedural_result,
    source_code
):
    """
    Establish source-to-sink relationships across function boundaries.

    Traversal is source-directed and bounded. Large bundles therefore do
    not require an all-pairs graph closure across unrelated framework code.
    """

    findings = []

    functions = interprocedural_result[
        "functions"
    ]

    interprocedural_flows = interprocedural_result[
        "flows"
    ]

    if not interprocedural_flows or not sources:
        return findings

    graph = _build_flow_graph(
        list(variable_flows)
        + list(interprocedural_flows)
    )

    flow_to_parameter = {}

    for flow in interprocedural_flows:
        parameter = flow.get("to")
        if parameter and parameter not in flow_to_parameter:
            flow_to_parameter[parameter] = flow.get(
                "from"
            )

    # Index parameters once instead of walking every function for every
    # source variable.
    parameter_to_functions = {}

    for function_info in functions.values():
        for parameter in function_info.parameters:
            parameter_to_functions.setdefault(
                parameter,
                []
            ).append(
                function_info
            )

    large_bundle = len(
        source_code or ""
    ) >= LARGE_BUNDLE_SIZE_BYTES

    max_nodes = (
        MAX_LARGE_BUNDLE_REACHABLE_NODES
        if large_bundle
        else MAX_REACHABLE_NODES
    )

    for source in sources:
        source_variable = source[
            "variable"
        ]

        reachable = _reachable_from(
            graph,
            source_variable,
            max_nodes=max_nodes
        )

        reachable_parameters = (
            reachable
            & set(parameter_to_functions.keys())
        )

        for parameter in reachable_parameters:
            argument_variable = flow_to_parameter.get(
                parameter
            )

            for function_info in parameter_to_functions.get(
                parameter,
                []
            ):
                sink_usages = find_parameter_sink_usage(
                    source_code,
                    function_info,
                    parameter
                )

                for sink_usage in sink_usages:
                    findings.append({
                        "type": "potential_sensitive_data_flow",
                        "source": source["source"],
                        "source_type": source["source_type"],
                        "variable": source_variable,
                        "file": source["file"],
                        "source_line": source["line"],
                        "sink": sink_usage["sink"],
                        "sink_line": sink_usage["line"],
                        "destination": sink_usage["destination"],
                        "transformations": [],
                        "flow_type": "interprocedural",
                        "source_reachable_variables": sorted(
                            reachable
                        ),
                        "argument_variable": argument_variable,
                        "parameter_variable": parameter,
                        "callee": function_info.name,
                        "call_line": sink_usage["line"],
                    })

    return findings

# ============================================================
# Evidence chain
# ============================================================

def build_interprocedural_chain(
    finding,
    variable_flows=None,
    interprocedural_flows=None
):
    """
    Construct a finding-specific source-to-sink chain.

    The previous implementation greedily selected the first outgoing
    graph edge. That could mix independent flows that happened to
    originate from the same variable (for example cookieData ->
    encodedCookie and cookieData -> data). This implementation finds
    a path toward the finding's actual parameter/sink target instead.
    """

    source = finding.get("source", "unknown")
    source_variable = finding.get("variable")
    parameter = finding.get("parameter_variable")
    sink = finding.get("sink")
    destination = finding.get("destination")

    chain = [source]

    if source_variable:
        chain.append(source_variable)

    # Build a directed graph while preserving edge metadata.
    edges = {}
    for flow in list(variable_flows or []) + list(interprocedural_flows or []):
        src = flow.get("from")
        dst = flow.get("to")
        if src and dst:
            edges.setdefault(src, []).append(flow)

    # For interprocedural findings, target the actual parameter. For
    # direct findings, target the sink argument variable when available.
    target = parameter

    if target is None:
        target = finding.get("argument_variable")

    # Breadth-first search for a path from source variable to target.
    path = []
    if source_variable and target and source_variable != target:
        queue = [(source_variable, [])]
        visited = {source_variable}

        while queue:
            current, current_path = queue.pop(0)

            for edge in edges.get(current, []):
                nxt = edge.get("to")
                if not nxt or nxt in visited:
                    continue

                next_path = current_path + [nxt]

                if nxt == target:
                    path = next_path
                    queue = []
                    break

                visited.add(nxt)
                queue.append((nxt, next_path))

            if path:
                break

    for value in path:
        if value not in chain:
            chain.append(value)

    if target and target not in chain:
        chain.append(target)

    if sink:
        chain.append(f"{sink}()")

    if destination:
        chain.append(destination)

    return " -> ".join(chain)


# ============================================================
# Large-bundle fast-path analysis
# ============================================================

def _large_bundle_direct_analysis(program_model, sources, source_code):
    """
    Security-focused analysis for very large/minified bundles.

    Large browser extensions frequently contain bundled React/framework,
    localization, polyfills and other third-party code. Running the full
    interprocedural engine over those files can become disproportionately
    expensive. This path keeps source-to-network reasoning, but only follows
    variables that are reachable from an actual sensitive source.

    This is a performance guard, not a security/risk rule.
    """
    assignments = getattr(program_model, "variable_assignments", []) or []
    calls = getattr(program_model, "function_calls", []) or []

    # Index assignments by identifiers used in their RHS. This avoids the
    # previous repeated full-list scans when propagating a source through a
    # large bundle.
    assignment_index = {}
    for assignment in assignments:
        value = assignment.value or ""
        for name in _identifier_names(value):
            assignment_index.setdefault(name, []).append(assignment)

    # Track only variables reachable from sensitive sources.
    reachable_by_source = {}
    flows = []

    for source in sources:
        start = source.get("variable")
        if not start:
            continue

        reachable = {start}
        queue = [start]
        position = 0

        while position < len(queue) and len(reachable) < MAX_LARGE_BUNDLE_REACHABLE_NODES:
            current = queue[position]
            position += 1

            for assignment in assignment_index.get(current, []):
                target = assignment.variable
                if not target or target in reachable:
                    continue

                if not expression_contains_variable(assignment.value or "", current):
                    continue

                reachable.add(target)
                queue.append(target)
                flows.append({
                    "from": current,
                    "to": target,
                    "type": "variable_to_variable",
                    "file": assignment.file,
                    "line": assignment.line,
                })

        reachable_by_source[start] = reachable
        flows.append({
            "from": source.get("source"),
            "to": start,
            "type": "source_to_variable",
            "file": source.get("file"),
            "line": source.get("line"),
        })

    network_operations = analyze_network_sinks(program_model)
    findings = []

    for source in sources:
        source_variable = source.get("variable")
        reachable = reachable_by_source.get(source_variable, {source_variable})

        for operation in network_operations:
            sink_expression = " ".join(operation.get("arguments", []) or [])
            matched_variable = None

            for variable in reachable:
                if variable and expression_contains_variable(sink_expression, variable):
                    matched_variable = variable
                    break

            if matched_variable is None:
                continue

            findings.append({
                "type": "potential_sensitive_data_flow",
                "source": source["source"],
                "source_type": source["source_type"],
                "variable": source_variable,
                "file": source["file"],
                "source_line": source["line"],
                "sink": operation["sink"],
                "sink_line": operation["line"],
                "destination": operation.get("destination"),
                "transformations": [],
                "flow_type": "direct",
                "source_reachable_variables": sorted(reachable),
            })

    # De-duplicate the same source/sink pair that can appear through multiple
    # equivalent variables in a minified bundle.
    unique = []
    seen = set()
    for finding in findings:
        key = (
            finding.get("source"),
            finding.get("source_line"),
            finding.get("sink"),
            finding.get("sink_line"),
            finding.get("destination"),
        )
        if key in seen:
            continue
        seen.add(key)
        unique.append(finding)

    return {
        "sources": sources,
        "variable_flows": flows,
        "interprocedural_flows": [],
        "return_flows": [],
        "transformations": [],
        "network_operations": network_operations,
        "findings": unique,
        "sensitive_data_flow": bool(unique),
        "interprocedural_functions": {},
    }


# ============================================================
# Main data-flow analyzer
# ============================================================

def analyze_data_flow(
    program_model,
    source_code=None
):
    """
    Complete data-flow analysis engine.
    """

    # --------------------------------------------------------
    # Load source code.
    # --------------------------------------------------------

    if source_code is None:

        try:

            with open(
                program_model.file,
                "r",
                encoding="utf-8",
                errors="ignore"
            ) as file:

                source_code = file.read()

        except OSError:

            source_code = ""

    # --------------------------------------------------------
    # Source discovery.
    # --------------------------------------------------------

    sources = find_sources(
        program_model
    )

    # --------------------------------------------------------
    # Large/minified bundle fast path.
    # --------------------------------------------------------
    #
    # Do not run the expensive interprocedural engine on multi-megabyte
    # bundles. These files are commonly generated framework/vendor bundles,
    # and repeatedly walking their entire function/call graph can take an
    # impractical amount of time. We still perform source-to-network
    # propagation from real sensitive sources.
    # --------------------------------------------------------

    if len(source_code or "") >= LARGE_BUNDLE_SIZE_BYTES:
        return _large_bundle_direct_analysis(
            program_model,
            sources,
            source_code,
        )

    # --------------------------------------------------------
    # Direct analysis.
    # --------------------------------------------------------

    variable_flows = build_variable_flow(
        program_model
    )

    # --------------------------------------------------------
    # Interprocedural analysis.
    # --------------------------------------------------------

    interprocedural_result = (
        build_interprocedural_flows(
            program_model,
            source_code
        )
    )

    # --------------------------------------------------------
    # Derived variables.
    # --------------------------------------------------------

    derived_variables = (
        interprocedural_result[
            "derived_variables"
        ]
    )

    # --------------------------------------------------------
    # Parameter-to-parameter propagation.
    # --------------------------------------------------------

    parameter_flows = (
        build_parameter_to_parameter_flows(
            source_code,
            interprocedural_result[
                "functions"
            ],
            interprocedural_result[
                "calls"
            ],
            {
                flow["to"]
                for flow in interprocedural_result[
                    "flows"
                ]
                if flow.get("type")
                in {
                    "argument_to_parameter",
                    "function_return_to_variable",
                }
            }
        )
    )

    for flow in parameter_flows:

        if flow not in interprocedural_result[
            "flows"
        ]:

            interprocedural_result[
                "flows"
            ].append(
                flow
            )

    # --------------------------------------------------------
    # Transformations.
    # --------------------------------------------------------

    transformations = (
        analyze_transformations(
            program_model,
            derived_variables
        )
    )

    # --------------------------------------------------------
    # Network operations.
    # --------------------------------------------------------

    network_operations = (
        analyze_network_sinks(
            program_model
        )
    )

    # --------------------------------------------------------
    # Direct findings.
    # --------------------------------------------------------

    direct_findings = (
        correlate_sources_and_sinks(
            program_model,
            sources,
            variable_flows,
            transformations,
            network_operations
        )
    )

    # --------------------------------------------------------
    # Interprocedural findings.
    # --------------------------------------------------------

    interprocedural_findings = (
        correlate_interprocedural_flows(
            program_model,
            sources,
            variable_flows,
            interprocedural_result,
            source_code
        )
    )

    # --------------------------------------------------------
    # Combine findings and remove duplicates.
    # --------------------------------------------------------

    findings = []

    seen = set()

    for finding in (
        direct_findings
        + interprocedural_findings
    ):

        key = (
            finding.get("source"),
            finding.get("source_line"),
            finding.get("sink"),
            finding.get("sink_line"),
            finding.get("destination"),
            finding.get("flow_type"),
            finding.get("parameter_variable"),
        )

        if key in seen:
            continue

        seen.add(
            key
        )

        if finding.get(
            "flow_type"
        ) == "interprocedural":

            finding[
                "evidence_chain"
            ] = build_interprocedural_chain(
                finding,
                variable_flows,
                interprocedural_result[
                    "flows"
                ]
            )

        else:

            finding[
                "evidence_chain"
            ] = None

        findings.append(
            finding
        )

    # --------------------------------------------------------
    # Final result.
    # --------------------------------------------------------

    return {
        "sources":
            sources,

        "variable_flows":
            variable_flows,

        "interprocedural_flows":
            interprocedural_result[
                "flows"
            ],

        "return_flows":
            interprocedural_result[
                "return_flows"
            ],

        "transformations":
            transformations,

        "network_operations":
            network_operations,

        "findings":
            findings,

        "sensitive_data_flow":
            bool(findings),

        "interprocedural_functions":
            {
                name: {
                    "parameters":
                        info.parameters,

                    "line":
                        info.line,

                    "end_line":
                        info.end_line,
                }

                for name, info
                in interprocedural_result[
                    "functions"
                ].items()
            },
    }
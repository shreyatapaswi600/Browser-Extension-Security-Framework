import re

from tree_sitter import Language, Parser

import tree_sitter_javascript

from analyzer.program_model import (
    ProgramModel,
    FunctionCall,
    VariableAssignment,
    MemberAccess,
    FunctionDefinition,
    FunctionParameter,
)


JS_LANGUAGE = Language(tree_sitter_javascript.language())


# ---------------------------------------------------------
# URL pattern
# ---------------------------------------------------------

URL_PATTERN = re.compile(
    r'https?://[^\s"\\\']+'
)


# ---------------------------------------------------------
# Source-byte cache
# ---------------------------------------------------------

_SOURCE_BYTES_CACHE = {
    "source_id": None,
    "source_text": None,
    "source_bytes": None,
}


def get_source_bytes(source_code):
    """
    Convert source text to UTF-8 bytes only once for the
    currently analyzed source file.

    Tree-sitter start_byte/end_byte values are UTF-8
    byte offsets.

    The previous implementation encoded the entire
    multi-megabyte JavaScript file every time get_node_text()
    was called. Since get_node_text() is called for many AST
    nodes, that caused severe performance degradation.
    """

    if source_code is None:
        return b""

    source_id = id(source_code)

    if (
        _SOURCE_BYTES_CACHE["source_id"] == source_id
        and _SOURCE_BYTES_CACHE["source_text"] is source_code
        and _SOURCE_BYTES_CACHE["source_bytes"] is not None
    ):
        return _SOURCE_BYTES_CACHE["source_bytes"]

    source_bytes = source_code.encode(
        "utf-8"
    )

    _SOURCE_BYTES_CACHE["source_id"] = source_id
    _SOURCE_BYTES_CACHE["source_text"] = source_code
    _SOURCE_BYTES_CACHE["source_bytes"] = source_bytes

    return source_bytes


def get_node_text(node, source_code):
    """
    Return the exact source text represented by a Tree-sitter node.

    Tree-sitter start_byte/end_byte values are UTF-8 byte offsets.

    The source is encoded only once per analyzed source file.
    """

    if node is None or source_code is None:
        return ""

    try:

        source_bytes = get_source_bytes(
            source_code
        )

        return source_bytes[
            node.start_byte:node.end_byte
        ].decode(
            "utf-8",
            errors="replace"
        )

    except Exception:

        return ""


def get_callable_name(function_node, source_code):
    """
    Extract a readable function/API name from a call expression.
    """

    function = function_node

    if function.type == "identifier":

        return get_node_text(
            function,
            source_code
        )

    if function.type == "member_expression":

        return get_node_text(
            function,
            source_code
        )

    return get_node_text(
        function,
        source_code
    )


def is_chained_member_expression(node):
    """
    Detect expressions such as:

        foo().bar()

    We do not want to treat the outer chained member
    expression as an independent API call.
    """

    if node.type != "member_expression":

        return False

    object_node = node.child_by_field_name(
        "object"
    )

    if object_node is None:

        return False

    return object_node.type == "call_expression"


def extract_arguments(arguments_node, source_code):
    """
    Extract source text for every function argument.
    """

    arguments = []

    if arguments_node is None:

        return arguments

    for child in arguments_node.named_children:

        arguments.append(
            get_node_text(
                child,
                source_code
            )
        )

    return arguments


def extract_function_parameters(
    parameters_node,
    source_code
):
    """
    Extract parameter names from a JavaScript function.
    """

    parameters = []

    if parameters_node is None:

        return parameters

    for child in parameters_node.named_children:

        if child.type == "identifier":

            parameters.append(
                get_node_text(
                    child,
                    source_code
                )
            )

        else:

            parameters.append(
                get_node_text(
                    child,
                    source_code
                )
            )

    return parameters


def extract_urls_from_text(text):
    """
    Extract HTTP/HTTPS URLs from source code.
    """

    return URL_PATTERN.findall(
        text
    )


def analyze_javascript_file(file_path):
    """
    Parse a JavaScript file and construct a structural
    ProgramModel using Tree-sitter.
    """

    with open(
        file_path,
        "r",
        encoding="utf-8",
        errors="ignore"
    ) as file:

        source_code = file.read()

    # Pre-encode once.

    source_bytes = get_source_bytes(
        source_code
    )

    parser = Parser(
        JS_LANGUAGE
    )

    tree = parser.parse(
        source_bytes
    )

    root = tree.root_node

    model = ProgramModel(
        file=file_path,
        syntax_error=root.has_error
    )

    # -----------------------------------------------------
    # URL extraction
    #
    # IMPORTANT:
    #
    # URLs are extracted once from the complete source,
    # instead of running the regex against every AST node.
    #
    # This preserves URL detection while eliminating a
    # potentially enormous amount of repeated work.
    # -----------------------------------------------------

    urls = extract_urls_from_text(
        source_code
    )

    for url in urls:

        if url not in model.urls:

            model.urls.append(
                url
            )

    def walk(node):

        # -------------------------------------------------
        # Function declarations
        # -------------------------------------------------

        if node.type == "function_declaration":

            name_node = node.child_by_field_name(
                "name"
            )

            parameters_node = node.child_by_field_name(
                "parameters"
            )

            if name_node is not None:

                function_name = get_node_text(
                    name_node,
                    source_code
                )

                parameters = extract_function_parameters(
                    parameters_node,
                    source_code
                )

                function_definition = FunctionDefinition(
                    name=function_name,
                    file=file_path,
                    line=node.start_point[0] + 1,
                    column=node.start_point[1],
                    parameters=parameters
                )

                model.function_definitions.append(
                    function_definition
                )

                for parameter in parameters:

                    parameter_info = FunctionParameter(
                        name=parameter,
                        function=function_name,
                        file=file_path,
                        line=node.start_point[0] + 1,
                        column=node.start_point[1]
                    )

                    model.function_parameters.append(
                        parameter_info
                    )

        # -------------------------------------------------
        # Function calls
        # -------------------------------------------------

        if node.type == "call_expression":

            function_node = node.child_by_field_name(
                "function"
            )

            arguments_node = node.child_by_field_name(
                "arguments"
            )

            if function_node is not None:

                function_name = get_callable_name(
                    function_node,
                    source_code
                )

                arguments = extract_arguments(
                    arguments_node,
                    source_code
                )

                model.function_calls.append(
                    FunctionCall(
                        name=function_name,
                        file=file_path,
                        line=node.start_point[0] + 1,
                        column=node.start_point[1],
                        arguments=arguments
                    )
                )

        # -------------------------------------------------
        # Variable assignments
        # -------------------------------------------------

        if node.type == "variable_declarator":

            name_node = node.child_by_field_name(
                "name"
            )

            value_node = node.child_by_field_name(
                "value"
            )

            if name_node is not None:

                variable_name = get_node_text(
                    name_node,
                    source_code
                )

                value = ""

                if value_node is not None:

                    value = get_node_text(
                        value_node,
                        source_code
                    )

                model.variable_assignments.append(
                    VariableAssignment(
                        variable=variable_name,
                        value=value,
                        file=file_path,
                        line=node.start_point[0] + 1,
                        column=node.start_point[1]
                    )
                )

        # -------------------------------------------------
        # Member/API access
        # -------------------------------------------------

        if node.type == "member_expression":

            if not is_chained_member_expression(
                node
            ):

                expression = get_node_text(
                    node,
                    source_code
                )

                model.member_access.append(
                    MemberAccess(
                        expression=expression,
                        file=file_path,
                        line=node.start_point[0] + 1,
                        column=node.start_point[1]
                    )
                )

        # -------------------------------------------------
        # Recursive traversal
        # -------------------------------------------------

        for child in node.named_children:

            walk(child)

    walk(root)

    return model


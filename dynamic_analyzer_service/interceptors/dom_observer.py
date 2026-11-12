def get_injection_script():
    return """
        (() => {
            function installObserver() {
                const root = document.documentElement;

                if (!root) {
                    document.addEventListener(
                        'DOMContentLoaded',
                        installObserver,
                        { once: true }
                    );
                    return;
                }

                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType !== Node.ELEMENT_NODE) {
                                return;
                            }

                            const candidates = [];

                            if (
                                node.tagName === 'INPUT' &&
                                node.type === 'password'
                            ) {
                                candidates.push(node);
                            }

                            if (node.querySelectorAll) {
                                candidates.push(
                                    ...node.querySelectorAll(
                                        'input[type="password"]'
                                    )
                                );
                            }

                            candidates.forEach((input) => {
                                console.log(
                                    '[HOOK] Suspicious password field injected'
                                );
                            });
                        });
                    });
                });

                observer.observe(root, {
                    childList: true,
                    subtree: true
                });
            }

            installObserver();
        })();
    """

Hooks.once("init", () => {
    let active = false;

    game.settings.register("token-locator", "active", {
        name: game.i18n.localize("token-locator.active"),
        scope: "client",
        config: true,
        requiresReload: false,
        type: Boolean,
        default: false,
        onChange: value => {
            if (game.settings.get("core", "noCanvas")) {
                return;
            }

            active = value;

            canvas.perception.update({ refreshVision: true });

            ui.controls.initialize();
        }
    });

    game.keybindings.register("token-locator", "active", {
        name: game.i18n.localize("token-locator.toggle"),
        editable: [
            { key: "KeyG", modifiers: [KeyboardManager.MODIFIER_KEYS.CONTROL] }
        ],
        restricted: false,
        onDown: () => {
            if (game.settings.get("core", "noCanvas")) {
                return;
            }

            game.settings.set("token-locator", "active", !active);

            return true;
        }
    });

    function setup() {
        if (game.settings.get("core", "noCanvas")) {
            return;
        }

        active = game.settings.get("token-locator", "active");

        CONFIG.Token.objectClass = class extends CONFIG.Token.objectClass {
            /** @override */
            get isVisible() {
                const visible = super.isVisible;
                const isHiding = this.actor?.statuses.has('hiding');

                if (!visible && !isHiding && active || visible && this.document.hidden) {
                    this.detectionFilter = hatchFilter;

                    return true;
                }

                return visible;
            }
        };

        class HatchFilter extends AbstractBaseFilter {
            /** @override */
            static vertexShader = `\
                attribute vec2 aVertexPosition;

                uniform vec4 inputSize;
                uniform vec4 outputFrame;
                uniform mat3 projectionMatrix;
                uniform vec2 origin;
                uniform mediump float thickness;

                varying vec2 vTextureCoord;
                varying float vOffset;

                void main() {
                    vTextureCoord = (aVertexPosition * outputFrame.zw) * inputSize.zw;
                    vec2 position = aVertexPosition * max(outputFrame.zw, vec2(0.0)) + outputFrame.xy;
                    vec2 offset = position - origin;
                    vOffset = (offset.x + offset.y) / (1.414213562373095 * 2.0 * thickness);
                    gl_Position = vec4((projectionMatrix * vec3(position, 1.0)).xy, 0.0, 1.0);
                }
            `;

            /** @override */
            static fragmentShader = `\
                varying vec2 vTextureCoord;
                varying float vOffset;

                uniform sampler2D uSampler;
                uniform mediump float thickness;

                void main() {
                    float x = abs(vOffset - floor(vOffset + 0.5)) * 2.0;
                    float y0 = clamp((x + 0.5) * thickness + 0.5, 0.0, 1.0);
                    float y1 = clamp((x - 0.5) * thickness + 0.5, 0.0, 1.0);
                    float y = y0 - y1;
                    float alpha = texture2D(uSampler, vTextureCoord).a * 0.25;
                    gl_FragColor = vec4(y, y, y, 1.0) * alpha;
                }
            `;

            /** @override */
            static defaultUniforms = {
                origin: { x: 0, y: 0 },
                thickness: 1
            };

            /** @override */
            apply(filterManager, input, output, clearMode, currentState) {
                const uniforms = this.uniforms;
                const worldTransform = currentState.target.worldTransform;

                uniforms.origin.x = worldTransform.tx;
                uniforms.origin.y = worldTransform.ty;
                uniforms.thickness = canvas.dimensions.size / 25 * canvas.stage.scale.x;

                super.apply(filterManager, input, output, clearMode, currentState);
            }
        }

        const hatchFilter = HatchFilter.create();

        Hooks.on("drawCanvasDarknessEffects", (layer) => {
            const index = layer.filters?.indexOf(layer.filter);

            layer.filter = new PIXI.AlphaFilter();

            if (index >= 0) {
                layer.filters[index] = layer.filter;
            }
        });

        Hooks.on("sightRefresh", () => {
            canvas.effects.darkness.filter.alpha = active ? 0.5 : 1;
        });

        CONFIG.Canvas.visualEffectsMaskingFilter = class extends CONFIG.Canvas.visualEffectsMaskingFilter {
            /** @override */
            static defaultUniforms = {
                ...super.defaultUniforms,
                bTokenLocator: false
            };

            /** @override */
            static fragmentHeader = `
                ${super.fragmentHeader}
                uniform bool bTokenLocator;
            `;

            /** @override */
            static fragmentPostProcess(postProcessModes) {
                return `
                    ${super.fragmentPostProcess(postProcessModes)}

                    if (mode == ${this.FILTER_MODES.ILLUMINATION} && bTokenLocator) {
                        finalColor.rgb = sqrt(finalColor.rgb) * 0.5 + 0.5;
                    }
                `;
            }
        };
    };

    Hooks.once("setup", setup);
});

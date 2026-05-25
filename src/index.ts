import { engine, Transform, Name, pointerEventsSystem, InputAction, GltfContainer } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { movePlayerTo, triggerEmote } from '~system/RestrictedActions'
import { setupUi } from './ui'

export function main() {
    // uncomment the line below to initialize UI from ui.tsx
    //setupUi()

    // 1. Define TV center and positioning constants
    const TV_POS = Vector3.create(8, 3.5, 0.25)
    const TOMATO_SCALE = Vector3.create(3.9, 3.9, 3.9)

    for (const [entity, name] of engine.getEntitiesWith(Name)) {
        if (name.value === 'Fruit Kiosk') {
            Transform.createOrReplace(entity, {
                position: Vector3.create(3.0, 0, 2.5),
                rotation: Quaternion.fromEulerDegrees(0, 90, 1), // Turned inwards
                scale: Vector3.create(1, 1, 1)
            })
        } else if (name.value === 'Beach Umbrella') {
            Transform.createOrReplace(entity, {
                position: Vector3.create(5.0, 0, 2.2),
                rotation: Quaternion.fromEulerDegrees(0, 0, 0),
                scale: Vector3.create(1, 1, 1)
            })
        } else if (name.value === 'Outdoor Chair') {
            Transform.createOrReplace(entity, {
                position: Vector3.create(4.0, 0, 2.5),
                rotation: Quaternion.fromEulerDegrees(0, 45, 0),
                scale: Vector3.create(1, 1, 1)
            })
        } else if (name.value === 'Garden Bed_18' || name.value === 'Garden Bed_19') {
            engine.removeEntityWithChildren(entity)
        }
    }

    // Define our 4 refined tiered rows of tomato seats (pushed back and heightened!)
    const rows = [
        { radius: 8.5, height: 0.5, seats: 4, maxAngle: 40 },
        { radius: 10.7, height: 1.4, seats: 5, maxAngle: 30 },
        { radius: 12.9, height: 2.3, seats: 5, maxAngle: 24 },
        { radius: 15.0, height: 3.2, seats: 6, maxAngle: 20 }
    ]

    // Compute all seat positions and rotations
    const seatTransforms: { position: Vector3; rotation: Quaternion }[] = []

    rows.forEach((row) => {
        const { radius, height, seats, maxAngle } = row

        for (let k = 0; k < seats; k++) {
            // Space seats evenly between -maxAngle and +maxAngle along the arc
            let angleDeg = 0
            if (seats > 1) {
                angleDeg = -maxAngle + (k * (2 * maxAngle)) / (seats - 1)
            }

            const angleRad = (angleDeg * Math.PI) / 180

            // Calculate coordinates on the arc centered around the TV
            const x = TV_POS.x + radius * Math.sin(angleRad)
            const z = TV_POS.z + radius * Math.cos(angleRad)
            const y = height

            // Calculate rotation to face the TV directly
            const dx = TV_POS.x - x
            const dz = TV_POS.z - z
            const lookAngleRad = Math.atan2(dx, dz)
            const rotation = Quaternion.fromEulerDegrees(0, (lookAngleRad * 180) / Math.PI, 0)

            seatTransforms.push({
                position: Vector3.create(x, y, z),
                rotation
            })
        }
    })

    // 2. Query all tomato entities and apply the new transforms and interactive sitting logic!
    let tomatoIndex = 0
    let totalTomatoCount = 0

    // First count the tomatoes
    for (const [entity, name] of engine.getEntitiesWith(Name)) {
        if (name.value.startsWith('Tomato')) {
            totalTomatoCount++
        }
    }
    console.log(`[Tomato Seating] Successfully counted ${totalTomatoCount} total tomatoes in the scene.`)

    // Position and configure them
    for (const [entity, name] of engine.getEntitiesWith(Name)) {
        if (name.value.startsWith('Tomato')) {
            if (tomatoIndex < seatTransforms.length) {
                const transform = seatTransforms[tomatoIndex]

                // Position, rotate, and scale the tomato chair
                Transform.createOrReplace(entity, {
                    position: transform.position,
                    rotation: transform.rotation,
                    scale: TOMATO_SCALE
                })

                // Programmatically force both physics and pointer collision masks to 3 (solid and clickable)
                const gltf = GltfContainer.getMutableOrNull(entity)
                if (gltf) {
                    gltf.visibleMeshesCollisionMask = 3 // CL_PHYSICS | CL_POINTER
                    gltf.invisibleMeshesCollisionMask = 3
                }

                // Add an elegant click-to-sit interaction
                pointerEventsSystem.onPointerDown(
                    {
                        entity: entity,
                        opts: {
                            button: InputAction.IA_POINTER,
                            hoverText: 'Sit on Tomato'
                        }
                    },
                    function () {
                        // Teleport the player onto the seat and turn their camera to watch the TV
                        void movePlayerTo({
                            newRelativePosition: Vector3.create(transform.position.x, transform.position.y + 0.9, transform.position.z),
                            cameraTarget: TV_POS
                        })
                        // Play the predefined sitting emote
                        void triggerEmote({ predefinedEmote: 'sittingChair1' })
                    }
                )

                tomatoIndex++
            } else {
                // If there are extra tomatoes, position them safely underneath the scene to avoid clutter
                Transform.createOrReplace(entity, {
                    position: Vector3.create(8, -10, 8),
                    scale: Vector3.create(0, 0, 0)
                })
            }
        }
    }
}

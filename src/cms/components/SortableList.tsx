import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

function SortableItem({
  id,
  children,
}: {
  id: string;
  children: (props: { dragHandleProps: Record<string, unknown> }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children({ dragHandleProps: { ...listeners } })}
    </div>
  );
}

export function DragHandle({ handleProps }: { handleProps: Record<string, unknown> }) {
  return (
    <button
      type="button"
      className="cursor-grab touch-none text-[var(--fg-muted)] hover:text-[var(--fg-base)]"
      aria-label="Drag to reorder"
      {...handleProps}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}

function useDndSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
}

export function DndContainer({
  children,
  onDragEnd,
}: {
  children: React.ReactNode;
  onDragEnd: (activeId: string, overId: string) => void;
}) {
  const sensors = useDndSensors();

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onDragEnd(String(active.id), String(over.id));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      {children}
    </DndContext>
  );
}

export function SortableItems<T>({
  items,
  renderItem,
  keyExtractor,
  layout = "vertical",
}: {
  items: T[];
  renderItem: (item: T, index: number, dragHandleProps: Record<string, unknown>) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  layout?: "vertical" | "horizontal";
}) {
  const strategy =
    layout === "horizontal" ? horizontalListSortingStrategy : verticalListSortingStrategy;

  return (
    <SortableContext
      items={items.map((item, i) => keyExtractor(item, i))}
      strategy={strategy}
    >
      {items.map((item, index) => (
        <SortableItem key={keyExtractor(item, index)} id={keyExtractor(item, index)}>
          {({ dragHandleProps }) => renderItem(item, index, dragHandleProps)}
        </SortableItem>
      ))}
    </SortableContext>
  );
}

export function SortableList<T>({
  items,
  onReorder,
  renderItem,
  keyExtractor,
  layout = "vertical",
}: {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number, dragHandleProps: Record<string, unknown>) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  layout?: "vertical" | "horizontal";
}) {
  const sensors = useDndSensors();

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const oldIndex = items.findIndex((item, i) => keyExtractor(item, i) === activeId);
    const newIndex = items.findIndex((item, i) => keyExtractor(item, i) === overId);

    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(arrayMove(items, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={items.map((item, i) => keyExtractor(item, i))}
        strategy={layout === "horizontal" ? horizontalListSortingStrategy : verticalListSortingStrategy}
      >
        {items.map((item, index) => (
          <SortableItem key={keyExtractor(item, index)} id={keyExtractor(item, index)}>
            {({ dragHandleProps }) => renderItem(item, index, dragHandleProps)}
          </SortableItem>
        ))}
      </SortableContext>
    </DndContext>
  );
}

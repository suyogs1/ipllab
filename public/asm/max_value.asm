; Find Maximum Value - Find the largest value in an array
; This program demonstrates comparison operations and conditional logic

.DATA
array: .WORD 3, 7, 2, 9, 1     ; Array of integers
len: .WORD 5                   ; Array length

.TEXT
start:
    MOV R1, array               ; Load array base address
    LOAD R0, [R1]               ; Load first element as initial max
    LOAD R2, [len]              ; Load array length
    DEC R2                      ; Decrement since we already processed first element
    ADD R1, #4                  ; Move to second element
    
loop:
    CMP R2, #0                  ; Check if we're done
    JZ done                     ; Jump if no more elements
    
    LOAD R3, [R1]               ; Load current element
    CMP R3, R0                  ; Compare with current max
    JLE skip                    ; Jump if current <= max
    MOV R0, R3                  ; Update max if current > max
    
skip:
    ADD R1, #4                  ; Move to next element
    DEC R2                      ; Decrement counter
    JMP loop                    ; Continue loop
    
done:
    ; R0 now contains the maximum value (9)
    SYS #1                      ; Print the result
    MOV R0, #0                  ; Exit code 0
    SYS #3                      ; Exit program
    HALT
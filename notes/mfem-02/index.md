---
title: MFEM 02
date: '2026-09-26'
description: Finite element implementation notes for a hyperelastostatic problem
tags: [Programming, Research]
language: en
draft: true
---

## Overview

Recently, I was asked to verify the implementation of a compressible Neo-Hookean model, so I chose a finite-deformation static problem as my second target task.

In MFEM 01, a linear elastic bar was solved entirely with MFEM's built-in integrators. Here the material is hyperelastic and the deformation is finite, so I write the two things MFEM cannot provide for me: the material model, and the element residual and tangent that go with it. Everything else, from the mesh to Newton's method, is still MFEM.

As in MFEM 01, I walk through the code in the order in which it is executed, placing each part alongside the corresponding formula it implements. The driver is `3d-elastostatics.cpp`; the material model and the integrator are header files in `include/`. The full code is available at [Chongran-Zhao/mfem-solids](https://github.com/Chongran-Zhao/mfem-solids).

## Problem setting

A body occupies $\Omega_0$ in its undeformed (reference) configuration, and $\bm X$ labels its material points. A displacement $\bm u(\bm X)$ carries each point to $\bm x = \bm X + \bm u$. Deformation is finite, loads are applied slowly enough that inertia is negligible (quasi-static), and every quantity is written on $\Omega_0$.

Here the body is a beam, $\Omega_0 = [0, 1] \times [0, 0.1] \times [0, 0.1]$. The left end $X = 0$ is clamped, the right end $X = 1$ is moved vertically by a prescribed $u_y = \bar u$, and the four lateral faces are traction-free. The reference case raises $\bar u$ from 0 to 0.5 in 25 load steps; the driver below solves the first one, $\bar u = 0.02$.

The deformation is measured by

$$
\bm F = \bm I + \operatorname{Grad}\bm u,
\qquad
J = \det \bm F,
\qquad
\bm C = \bm F^{\mathrm{T}} \bm F,
\qquad
\bm E = \tfrac12 (\bm C - \bm I),
$$

where $\operatorname{Grad}$ is the gradient with respect to $\bm X$. Capitalized operators, $\operatorname{Grad}$ and $\operatorname{Div}$, always act on the reference coordinates $\bm X$. 

Balance of linear momentum without inertia, written on $\Omega_0$, is $\operatorname{Div}\bm P + \bm B = \bm 0$, with $\bm B$ the body force per reference volume. **Body force is neglected here ($\bm B = \bm 0$), as in the code.** The strong form is then

$$
\boxed{\;
\operatorname{Div} \bm P = \bm 0 \;\text{ in } \Omega_0,
\qquad
\underbrace{\bm u = \bar{\bm u} \;\text{ on } \Gamma_D}_{\text{essential}},
\qquad
\underbrace{\bm P\,\bm N = \bar{\bm T} \;\text{ on } \Gamma_N}_{\text{natural}}
\;}
\label{strong_form}
$$

- $\bm N$ the reference outward normal, $\bar{\bm T}$ the traction per reference area, and $\partial\Omega_0 = \Gamma_D \cup \Gamma_N$. For the beam, $\bar{\bm T} = \bm 0$.
- $\bm P$ is not symmetric. The symmetric stress work-conjugate to $\bm E$ is the second Piola–Kirchhoff stress $\bm S$, related by $\bm P = \bm F\bm S$.

## 1. Mesh

```c++
const char *mesh_file = ".../Beam_coarse-hex.mesh";
mfem::Mesh mesh(mesh_file, 1, 1);
```

**Notation.** From here on two kinds of objects appear side by side, and they are written differently:

- **Tensors** are continuous fields with a direct physical meaning, such as $\bm u^h$, $\bm F^h$ and $\bm P^h$. They are written in bold italic, $\bm F$, and their components carry tensor indices, $F_{kJ}$.
- **Discrete finite element quantities** are arrays of numbers built from nodal values, such as the element displacement vector or the element stiffness matrix. They are written in sans-serif, $\mathsf d$, and their entries are counted by mesh indices.

**Mesh.** The body is divided into elements, $\Omega_0 \approx \bigcup_\mathbf{e} \Omega^\mathbf{e}$. Mesh indices are written in bold upright letters, to keep them apart from the tensor indices $i,j,k,l$ and $I,J,K,L$:

- $\mathbf{e}$ numbers the elements;
- $\mathbf{a}, \mathbf{b}$ number the nodes of one element, from $1$ to $n$;
- $\mathbf{A}$ numbers the nodes of the whole mesh.

As for the bar, a connectivity table $\mathbf{A} = \ell(\mathbf{e}, \mathbf{a})$ gives the global number of local node $\mathbf{a}$ of element $\mathbf{e}$.

- **The mesh is the reference configuration, and it never moves.** In the Total Lagrangian form the node coordinates stay at $\bm X$; the deformation lives only in the displacement.
- The coarse beam has 80 hexahedra ($20 \times 2 \times 2$) and 189 vertices. The mesh file labels its boundary faces with attributes:

| Boundary faces | Location | Attribute |
|---|---|---|
| left end | $X = 0$ | 1 |
| right end | $X = 1$ | 2 |
| lateral faces | $Y, Z \in \{0, 0.1\}$ | 3 to 6 |

## 2. Finite element space and interpolation

```c++
const int dim = mesh.Dimension();
const int order = 1;
mfem::H1_FECollection fec(order, dim);
mfem::FiniteElementSpace fespace(&mesh, &fec, dim,
                                mfem::Ordering::byVDIM);
mfem::GridFunction disp(&fespace);
disp = 0.0;
```

`fec` is the trilinear hexahedron, with $n = 8$ nodes and shape functions $N^\mathbf{a}$. `fespace` puts three components on each node, `vdim = dim = 3`, so the beam has $3 \times 189 = 567$ displacement unknowns, and `disp` holds their values.

**Interpolation on one element.** Node $\mathbf{a}$ sits at the reference position $\bm X^\mathbf{a}$ and carries three numbers $d^\mathbf{a}_k$, $k = 1,2,3$, its displacement in the three coordinate directions. Inside $\Omega^\mathbf{e}$, the displacement field and the test function are interpolated from these nodal values with the shape functions of the element, the scalar functions $N^\mathbf{a}(\bm X)$:

$$
\label{discrete_disp}
u^h_k(\bm X) = \sum_{\mathbf{a}=1}^{n} N^\mathbf{a}(\bm X)\, d^\mathbf{a}_k,
\qquad
w^h_k(\bm X) = \sum_{\mathbf{a}=1}^{n} N^\mathbf{a}(\bm X)\, w^\mathbf{a}_k,
\qquad
\bm X \in \Omega^\mathbf{e} .
$$

The superscript $h$ marks discrete fields. The left-hand sides are components of the tensor fields $\bm u^h$ and $\bm w^h$; the right-hand sides mix the two kinds of objects: all the dependence on position is carried by $N^\mathbf{a}(\bm X)$, and the nodal values $d^\mathbf{a}_k$, $w^\mathbf{a}_k$ are just numbers. Since $N^\mathbf{a}(\bm X^\mathbf{b}) = \delta_{\mathbf{a}\mathbf{b}}$, evaluating $u^h_k$ at node $\mathbf{b}$ returns $d^\mathbf{b}_k$, so $d^\mathbf{a}_k$ is exactly the displacement of node $\mathbf{a}$ in direction $k$.

**Deformation gradient.** Since $F^h_{kJ} = \delta_{kJ} + \partial u^h_k / \partial X_J$ and the nodal values do not depend on $\bm X$, only the shape functions are differentiated:
$$
F^h_{kJ} = \delta_{kJ} + \sum_{\mathbf{a}=1}^{n} d^\mathbf{a}_k\, N^\mathbf{a}_{,J} .
\label{def_grad}
$$

So the tensor $\bm F^h$, and through the material law also $\bm C^h$, $\bm S^h$ and $\bm P^h$, is known once the nodal displacements $d^\mathbf{a}_k$ and the shape function gradients $N^\mathbf{a}_{,J}$ are known.

Collected over the nodes $\mathbf{a}$ and directions $k$ of the element, the nodal displacements form the element displacement vector, numbered direction by direction as in the code (`disp(aa + k*num_nodes)`, step 6):

$$
\big(\mathsf d^\mathbf{e}\big)_P = d^\mathbf{a}_k,
\qquad
P = \mathbf{a} + (k-1)\,n,
\qquad
\mathsf d^\mathbf{e} \in \mathbb R^{3n} .
$$

- **`byVDIM` only orders the global vector**, node by node: $x_1, y_1, z_1, x_2, \dots$ The element vectors that the integrator receives are always ordered direction by direction (step 7), whatever the global ordering.
- **`disp` is a function, not just a vector**: its values are the nodal displacements $d^\mathbf{A}_k$, and `fespace` supplies the shape functions.

## 3. Boundary conditions

```c++
mfem::Array<int> ess_bdr_x(mesh.bdr_attributes.Max());
mfem::Array<int> ess_bdr_y(mesh.bdr_attributes.Max());
mfem::Array<int> ess_bdr_z(mesh.bdr_attributes.Max());
ess_bdr_x = 0;
ess_bdr_y = 0;
ess_bdr_z = 0;
ess_bdr_x[0] = 1;
ess_bdr_y[0] = 1;
ess_bdr_y[1] = 1;
ess_bdr_z[0] = 1;

mfem::Array<int> ess_tdof_x, ess_tdof_y, ess_tdof_z, ess_tdof_list;
fespace.GetEssentialTrueDofs(ess_bdr_x, ess_tdof_x, 0);
fespace.GetEssentialTrueDofs(ess_bdr_y, ess_tdof_y, 1);
fespace.GetEssentialTrueDofs(ess_bdr_z, ess_tdof_z, 2);
ess_tdof_list.Append(ess_tdof_x);
ess_tdof_list.Append(ess_tdof_y);
ess_tdof_list.Append(ess_tdof_z);
```

| Direction | Attribute 1 (left end) | Attribute 2 (right end) |
|---|---|---|
| $x$ | fixed, $u_x = 0$ | free |
| $y$ | fixed, $u_y = 0$ | prescribed, $u_y = \bar u$ |
| $z$ | fixed, $u_z = 0$ | free |

- Unlike the bar, each direction has its own list of constrained boundaries, and the last argument of `GetEssentialTrueDofs` picks the component. The three lists are merged into `ess_tdof_list`, 36 unknowns in total.
- On the right end only $u_y$ is prescribed; $u_x$ and $u_z$ remain unknown there.

```c++
const double prescribed_uy = 0.02;
mfem::ConstantCoefficient right_uy(prescribed_uy);
mfem::Coefficient *right_disp[3] = {nullptr, &right_uy, nullptr};
mfem::Array<int> right_bdr(mesh.bdr_attributes.Max());
right_bdr = 0;
right_bdr[1] = 1;
disp.ProjectBdrCoefficient(right_disp, right_bdr);
```

$$
\mathcal U^h = \{\, \bm u^h : d^\mathbf{A}_k = \bar u^\mathbf{A}_k \text{ for every constrained } (\mathbf{A}, k) \,\},
\qquad
\mathcal V^h = \{\, \bm w^h : w^\mathbf{A}_k = 0 \text{ for every constrained } (\mathbf{A}, k) \,\}
$$

- `ProjectBdrCoefficient` writes $\bar u = 0.02$ into the $y$-components of `disp` on attribute 2. The `nullptr` entries leave $x$ and $z$ untouched, and the left end keeps the zeros of step 2.
- **This step only collects indices and values. They are imposed in step 9**, where Newton's method starts from `disp` and never changes the constrained entries.

## 4. Material model

```c++
const double young = 540.0e3;
const double poisson = 0.324;
const double mu = young / (2.0 * (1.0 + poisson));
const double kappa = young / (3.0 * (1.0 - 2.0 * poisson));
const CompressibleNeoHookean material(kappa, mu);
```

| Symbol | Variable | Value |
|---|---|---|
| $E$ | `young` | 540 kPa |
| $\nu$ | `poisson` | 0.324 |
| $\mu = E / 2(1+\nu)$ | `mu` | 203.9 kPa |
| $\kappa = E / 3(1-2\nu)$ | `kappa` | 511.4 kPa |

The compressible Neo-Hookean model splits the strain energy into an isochoric and a volumetric part,

$$
\Psi = \frac{\mu}{2}\big( J^{-2/3} \operatorname{tr}\bm C - 3 \big) + \frac{\kappa}{2} (J - 1)^2 ,
$$

and `CompressibleNeoHookean` returns its first two derivatives with respect to $\bm C$:

```c++
Tensor2_3D get_2nd_PK_stress(const Tensor2_3D &F) const override
{
   ...
   return mu * J_m23 * Tensor2_3D::identity()
          + (kappa * det_F * (det_F - 1.0) - 1.0/3.0 * mu * J_m23 * tr_C )* C_inv;
}

Tensor4_3D get_2nd_elasticity_tensor(const Tensor2_3D &F) const override
{
   ...
   return -2.0 / 3.0 * mu * J_m23 * (otimes(Id, C_inv) + otimes(C_inv, Id))
         + (kappa * det_F * (2.0 * det_F - 1.0) + 2.0 * mu / 9.0 * J_m23 * tr_C) * otimes(C_inv, C_inv)
         - 2.0 * (kappa * det_F * (det_F - 1.0) - 1.0/3.0 * mu * J_m23 * tr_C) * odot(C_inv, C_inv);
}
```

$$
\bm S = 2\frac{\partial\Psi}{\partial\bm C}
= \mu J^{-2/3}\, \bm I + \Big( \kappa J (J - 1) - \frac{\mu}{3} J^{-2/3} \operatorname{tr}\bm C \Big)\, \bm C^{-1},
$$

$$
\begin{aligned}
\mathbb C = 2\frac{\partial\bm S}{\partial\bm C}
={}& -\frac{2\mu}{3} J^{-2/3} \big( \bm I \otimes \bm C^{-1} + \bm C^{-1} \otimes \bm I \big)
+ \Big( \kappa J (2J - 1) + \frac{2\mu}{9} J^{-2/3} \operatorname{tr}\bm C \Big)\, \bm C^{-1} \otimes \bm C^{-1} \\
&- 2 \Big( \kappa J (J - 1) - \frac{\mu}{3} J^{-2/3} \operatorname{tr}\bm C \Big)\, \bm C^{-1} \odot \bm C^{-1},
\end{aligned}
$$

with $(\bm A \otimes \bm B)_{IJKL} = A_{IJ} B_{KL}$ and $(\bm A \odot \bm B)_{IJKL} = \tfrac12 (A_{IK} B_{JL} + A_{IL} B_{JK})$. From these two, the base class `HyperelasticMaterialModel` builds the two-point quantities that the integrator needs:

```c++
Tensor2_3D get_1st_PK_stress(const Tensor2_3D &F) const
{
   return F * get_2nd_PK_stress(F);
}

// AA_iJkL = F_iM CC_MJNL F_kN + delta_ik S_JL.
Tensor4_3D get_1st_elasticity_tensor(const Tensor2_3D &F) const;
```

$$
\bm P = \bm F \bm S,
\qquad
\mathbb A_{kJlL} = \frac{\partial P_{kJ}}{\partial F_{lL}} = \sum_{I,K} F_{kI}\, \mathbb C_{IJKL}\, F_{lK} + \delta_{kl}\, S_{JL} .
$$

- **The material only sees $\bm F$.** It knows nothing about elements, nodes or quadrature, so the same integrator works for any model derived from `HyperelasticMaterialModel`.
- $\bm P$ enters the residual (step 6) and $\mathbb A$ the tangent (step 7); step 7 shows where the formula for $\mathbb A$ comes from.

## 5. Weak form and the nonlinear form

```c++
mfem::NonlinearForm nonlinear_form(&fespace);
nonlinear_form.AddDomainIntegrator(
   new CompressibleHyperelasticIntegrator(material));
nonlinear_form.SetEssentialTrueDofs(ess_tdof_list);
```

Take a test function $\bm w$ that vanishes where the displacement is prescribed, $\bm w = \bm 0$ on $\Gamma_D$. Multiply Eq. $\eqref{strong_form}$ by it and integrate over the body,

$$
\label{diff_eq}
\int_{\Omega_0} \bm w \cdot \operatorname{Div} \bm P \; dV = 0 .
$$

The integrand contains a derivative of $\bm P$, which is what the weak form moves onto $\bm w$. The product rule for a divergence, written with indices ($P_{kJ,J} = \partial P_{kJ}/\partial X_J$), is

$$
\sum_{J} \Big( \sum_{k} w_k P_{kJ} \Big)_{,J} = \sum_{k,J} w_k\, P_{kJ,J} + \sum_{k,J} w_{k,J}\, P_{kJ}
\quad\Longleftrightarrow\quad
\operatorname{Div}\big(\bm P^{\mathrm{T}} \bm w\big) = \bm w \cdot \operatorname{Div}\bm P + \bm P : \operatorname{Grad}\bm w ,
$$

We use lowercase indices such as $i,j,k,l$ to denote the basis components associated with the current configuration, and uppercase indices such as $I,J,K,L$ to denote those associated with the reference configuration. The first Piola–Kirchhoff stress $\bm P$ is a two-point tensor, with one index referring to the current configuration and the other to the reference configuration, so its components are written as $P_{kJ}$. The test function $w_k$ is defined over the reference configuration. Note that all these indices refer to three-dimensional space and therefore take values $1,2,3$.

so the integral $\eqref{diff_eq}$ splits into a divergence and a term with $\operatorname{Grad}\bm w$,
$$
\int_{\Omega_0} \bm w \cdot \operatorname{Div} \bm P \; dV = \int_{\Omega_0} \operatorname{Div}\big(\bm P^{\mathrm{T}} \bm w\big) \; dV - \int_{\Omega_0} \bm P : \operatorname{Grad}\bm w \; dV = 0 .
$$

The divergence theorem turns the first integral into a boundary integral, and $(\bm P^{\mathrm{T}}\bm w)\cdot\bm N = \bm w \cdot \bm P\bm N$,

$$
\int_{\Omega_0} \operatorname{Div}\big(\bm P^{\mathrm{T}} \bm w\big) \; dV
= \int_{\partial\Omega_0} \bm w \cdot \bm P\,\bm N \; dA
= \underbrace{\int_{\Gamma_D} \bm w \cdot \bm P\,\bm N \; dA}_{=\,0,\;\; \bm w \,=\, \bm 0}
+ \underbrace{\int_{\Gamma_N} \bm w \cdot \bm P\,\bm N \; dA}_{\bm P\bm N \,=\, \bar{\bm T}} .
$$

Putting the pieces together:

$$
\int_{\Omega_0} \bm P : \operatorname{Grad}\bm w \; dV
= \int_{\Gamma_N} \bar{\bm T} \cdot \bm w \; dA
\qquad \forall\, \bm w,\;\; \bm w = \bm 0 \text{ on } \Gamma_D.
\label{weak_form}
$$

**From the body to one element.** The weak form, Eq. $\eqref{weak_form}$, is a single statement about the whole body: the balance of momentum, tested against every admissible $\bm w$. Its integrals, however, are additive over non-overlapping pieces. The elements cover $\Omega_0$, and their faces on $\Gamma_N$ cover $\Gamma_N$, so moving everything to one side, Eq. $\eqref{weak_form}$ becomes a sum of element contributions,

$$
\sum_\mathbf{e} \left[\;
\int_{\Omega^\mathbf{e}} \bm P : \operatorname{Grad}\bm w \; dV
- \int_{\partial\Omega^\mathbf{e} \cap \Gamma_N} \bar{\bm T} \cdot \bm w \; dA
\;\right] = 0 .
$$

Each bracket only involves the fields inside one element, and those are described by the nodal values of that element through the interpolation of step 2.

- **`NonlinearForm` is the sum over elements; the integrator is one bracket.** MFEM loops over the elements and adds up their contributions (step 9); the integrator only has to evaluate the bracket of one element, which is what steps 6 and 7 derive.
- `AddDomainIntegrator` only stores a pointer: `nonlinear_form` owns the integrator and deletes it, while the integrator keeps a reference to `material`, which must therefore outlive `nonlinear_form`.
- There is no traction integrator: $\bar{\bm T} = \bm 0$ on the free faces, so the boundary integral vanishes.

## 6. Element residual

Insert the interpolation of step 2 into the bracket of element $\mathbf{e}$. With the same shape functions for $\bm u$ and $\bm w$ (Galerkin), $\bm P$ becomes $\bm P^h = \bm P(\bm F^h)$. Writing $\bm P : \operatorname{Grad}\bm w = \sum_{k,J} P_{kJ}\, w_{k,J}$ and $\bar{\bm T} \cdot \bm w = \sum_k \bar T_k\, w_k$, the bracket reads

$$
\int_{\Omega^\mathbf{e}} \sum_{k,J} P^h_{kJ}\, w^h_{k,J} \; dV
- \int_{\partial\Omega^\mathbf{e} \cap \Gamma_N} \sum_{k} \bar T_k\, w^h_k \; dA .
$$

A note on sums. The summation convention is not used in this note: every sum is written out with an explicit $\sum$. This matters because two kinds of indices appear side by side, tensor indices ($i,j,k,l$ and $I,J,K,L$) and mesh indices ($\mathbf{a}$, $\mathbf{b}$, $\mathbf{e}$), and the derivation below moves sums of both kinds in and out of integrals. With every sum visible, it is always clear which indices are summed and which are free.

Take the bracket of one element and follow it through four steps.

**Step 1: substitute the interpolation.** Inside $\Omega^\mathbf{e}$ the test function and its gradient are

$$
w^h_k = \sum_{\mathbf{a}} N^\mathbf{a}\, w^\mathbf{a}_k,
\qquad
w^h_{k,J} = \sum_{\mathbf{a}} N^\mathbf{a}_{,J}\, w^\mathbf{a}_k ,
$$

where only $N^\mathbf{a}$ is differentiated, since the nodal values $w^\mathbf{a}_k$ are constants. The bracket becomes

$$
\int_{\Omega^\mathbf{e}} \sum_{k,J} P^h_{kJ} \Big( \sum_{\mathbf{a}} N^\mathbf{a}_{,J}\, w^\mathbf{a}_k \Big) dV
- \int_{\partial\Omega^\mathbf{e} \cap \Gamma_N} \sum_{k} \bar T_k \Big( \sum_{\mathbf{a}} N^\mathbf{a}\, w^\mathbf{a}_k \Big) dA .
$$

**Step 2: put all the sums in front.** The first integrand now contains three sums, over $k$, $J$ and $\mathbf{a}$; the second contains two, over $k$ and $\mathbf{a}$. Moving the inner sum over $\mathbf{a}$ out of the parentheses,

$$
\int_{\Omega^\mathbf{e}} \sum_{k}\sum_{J}\sum_{\mathbf{a}} P^h_{kJ}\, N^\mathbf{a}_{,J}\, w^\mathbf{a}_k \; dV
- \int_{\partial\Omega^\mathbf{e} \cap \Gamma_N} \sum_{k}\sum_{\mathbf{a}} \bar T_k\, N^\mathbf{a}\, w^\mathbf{a}_k \; dA .
$$

**Step 3: reorder the sums and take them out of the integrals.** Finite sums can be taken in any order, so put $\mathbf{a}$ and $k$ outermost and leave $J$ inside. Integration is linear and $w^\mathbf{a}_k$ does not depend on $\bm X$, so both the sums over $\mathbf{a}, k$ and the factor $w^\mathbf{a}_k$ come out of the integrals:

$$
\sum_{\mathbf{a}}\sum_{k} w^\mathbf{a}_k \int_{\Omega^\mathbf{e}} \sum_{J} N^\mathbf{a}_{,J}\, P^h_{kJ} \; dV
- \sum_{\mathbf{a}}\sum_{k} w^\mathbf{a}_k \int_{\partial\Omega^\mathbf{e} \cap \Gamma_N} N^\mathbf{a}\, \bar T_k \; dA .
$$

$J$ stays inside because it only connects $\bm P^h$ with $\operatorname{Grad} N^\mathbf{a}$; $k$ comes out because it belongs to $w^\mathbf{a}_k$.

**Step 4: collect the coefficient of each $w^\mathbf{a}_k$.** Both terms carry the same $w^\mathbf{a}_k$:
$$
\sum_{\mathbf{a},k} w^\mathbf{a}_k \left[\;
\int_{\Omega^\mathbf{e}} \sum_{J} N^\mathbf{a}_{,J}\, P^h_{kJ} \; dV
- \int_{\partial\Omega^\mathbf{e} \cap \Gamma_N} N^\mathbf{a}\, \bar T_k \; dA
\;\right]
= \sum_{\mathbf{a},k} w^\mathbf{a}_k\, R^\mathbf{a}_k .
$$

The **element residual** is

$$
\boxed{\;
R^\mathbf{a}_k(\bm u^h)
= \int_{\Omega^\mathbf{e}} \sum_{J} N^\mathbf{a}_{,J}\; P^h_{kJ}\big(\bm F^h(\bm u^h)\big) \; dV
\;-\; \int_{\partial\Omega^\mathbf{e} \cap \Gamma_N} N^\mathbf{a}\, \bar T_k \; dA
\;}
\label{elem_residual}
$$

Collected over the nodes $\mathbf{a}$ and directions $k$ of the element, these components form the element residual vector. As in the code, the entries are numbered direction by direction, first the $x$-components of the $n$ nodes, then $y$, then $z$:

$$
\big(\mathsf R^\mathbf{e}\big)_P = R^\mathbf{a}_k,
\qquad
P = \mathbf{a} + (k-1)\,n,
\qquad
\mathsf R^\mathbf{e} \in \mathbb R^{3n} .
$$

**The code.** `AssembleElementVector` evaluates Eq. $\eqref{elem_residual}$ without the traction term:

```c++
void AssembleElementVector(const mfem::FiniteElement &elem,
                           mfem::ElementTransformation &elem_map,
                           const mfem::Vector &disp,
                           mfem::Vector &residual) override
{
   const int num_nodes = elem.GetDof();
   mfem::DenseMatrix dN_dxi(num_nodes, 3), dN_dX(num_nodes, 3);

   residual.SetSize(3 * num_nodes);
   residual = 0.0;

   const mfem::IntegrationRule &quad_rule = get_quad_rule(elem, elem_map);

   for (int qq = 0; qq < quad_rule.GetNPoints(); qq++)
   {
      const mfem::IntegrationPoint &quad_pt = quad_rule.IntPoint(qq);
      elem_map.SetIntPoint(&quad_pt);

      // dN/dxi
      elem.CalcDShape(quad_pt, dN_dxi);
      // N_a,J = dN/dX = dN/dxi (dX/dxi)^-1.
      mfem::Mult(dN_dxi, elem_map.InverseJacobian(), dN_dX);

      const Tensor2_3D F = get_deformation_gradient(disp, dN_dX);

      const Tensor2_3D PK1 = material.get_1st_PK_stress(F);

      // dV = w_q * det( dX/dxi )
      const double dV = quad_pt.weight * elem_map.Weight();

      for (int aa = 0; aa < num_nodes; aa++)
      {
         // x-component
         residual(aa)             += dV * (PK1(0, 0) * dN_dX(aa, 0)
                                         + PK1(0, 1) * dN_dX(aa, 1)
                                         + PK1(0, 2) * dN_dX(aa, 2));
         // y- and z-components: rows 1 and 2 of PK1
         ...
      }
   }
}
```

| Symbol | Code |
|---|---|
| $n$ | `num_nodes` |
| $d^\mathbf{a}_k$ | `disp(aa + k*num_nodes)`, $k$ counted from 0 |
| $N^\mathbf{a}_{,J}$ | `dN_dX(aa, J)` |
| $\bm F^h$, Eq. $\eqref{def_grad}$ | `get_deformation_gradient(disp, dN_dX)` |
| $\bm P^h$ | `PK1` |
| $\omega_q \det(\partial\bm X/\partial\bm\xi)$ | `dV` (step 8) |
| $R^\mathbf{a}_k$ | `residual(aa + k*num_nodes)` |

- **The function name is fixed.** `AssembleElementVector` overrides a virtual function of `NonlinearFormIntegrator`, and `NonlinearForm` calls it through a base-class pointer. Only the parameter names are ours.
- **The element vectors are ordered direction by direction**: first the $x$-components of the $n$ nodes, then $y$, then $z$. `GetElementVDofs` always returns them in this order, independently of the `byVDIM` global ordering of step 2.
- `elem` is the reference element, shared by all hexahedra, and only knows $\hat N^\mathbf{a}(\bm\xi)$; `elem_map` knows the node coordinates of this element and supplies $(\partial\bm X/\partial\bm\xi)^{-1}$ and its determinant.

In the driver, one call evaluates the global residual at the displacement of step 3:

```c++
mfem::Vector disp_true;
disp.GetTrueDofs(disp_true);

mfem::Vector residual(fespace.GetTrueVSize());
nonlinear_form.Mult(disp_true, residual);
```

`Mult` calls `AssembleElementVector` once per element and adds the results into `residual` (step 9). Only the right-end nodes have moved, so the elements next to them are strained and the residual is far from zero; Newton's method will remove it.

## 7. Element stiffness

**From the field $\bm u^h$ to the nodal values $\mathsf d^\mathbf{e}$.** Eq. $\eqref{elem_residual}$ writes the residual in terms of the field $\bm u^h$, but a field cannot be the unknown of a program; the unknowns are the nodal values. On $\Omega^\mathbf{e}$ the two carry the same information: by Eq. $\eqref{discrete_disp}$ the field is fixed by the element's nodal displacements,
$$
u^h_k(\bm X) = \sum_{\mathbf{b}=1}^{n} N^\mathbf{b}(\bm X)\, d^\mathbf{b}_k ,
$$

so, with the nodal values collected in $\mathsf d^\mathbf{e}$, the residual is a function of $\mathsf d^\mathbf{e}$ alone, $R^\mathbf{a}_k(\mathsf d^\mathbf{e}) := R^\mathbf{a}_k\big(\bm u^h[\mathsf d^\mathbf{e}]\big)$. The map from $\mathsf d^\mathbf{e}$ to $\bm u^h$ is linear, and its derivatives are just the shape functions,

$$
\frac{\partial u^h_k}{\partial d^\mathbf{b}_l} = \delta_{kl}\, N^\mathbf{b},
\qquad
\frac{\partial F^h_{kJ}}{\partial d^\mathbf{b}_l} = \delta_{kl}\, N^\mathbf{b}_{,J} .
$$

Differentiating with respect to one nodal value $d^\mathbf{b}_l$ therefore means: move node $\mathbf{b}$ in direction $l$; the field $\bm u^h$ changes by $N^\mathbf{b}$ in that direction, and $\bm F^h$ by $N^\mathbf{b}_{,J}$ in row $l$.

$\mathsf R^\mathbf{e}$ is nonlinear in $\mathsf d^\mathbf{e}$, so the equations it leads to are solved by Newton's method (step 9), and Newton's method needs the derivative of the residual. That derivative is computed element by element. Perturb the element displacements by $\Delta\mathsf d^\mathbf{e}$ and expand the element residual to first order:

$$
\mathsf R^\mathbf{e}(\mathsf d^\mathbf{e} + \Delta\mathsf d^\mathbf{e})
\approx \mathsf R^\mathbf{e}(\mathsf d^\mathbf{e}) + \mathsf K^\mathbf{e}\, \Delta\mathsf d^\mathbf{e},
\qquad
\mathsf K^\mathbf{e} = \frac{\partial \mathsf R^\mathbf{e}}{\partial \mathsf d^\mathbf{e}} .
$$

$\mathsf K^\mathbf{e}$ is the **element stiffness matrix**. Written entry by entry, with $\mathsf K^\mathbf{e} = \big[\, K^{\mathbf{a}\mathbf{b}}_{kl} \,\big]$, the same expansion reads

$$
R^\mathbf{a}_k(\mathsf d^\mathbf{e} + \Delta\mathsf d^\mathbf{e})
\approx R^\mathbf{a}_k(\mathsf d^\mathbf{e}) + \sum_{\mathbf{b},l} K^{\mathbf{a}\mathbf{b}}_{kl}\, \Delta d^\mathbf{b}_l,
\qquad
\boxed{\;
K^{\mathbf{a}\mathbf{b}}_{kl} = \frac{\partial R^\mathbf{a}_k}{\partial d^\mathbf{b}_l}
\;}
\label{tangent_def}
$$

$K^{\mathbf{a}\mathbf{b}}_{kl}$ says how much the residual at node $\mathbf{a}$, direction $k$, changes when node $\mathbf{b}$ moves in direction $l$. The rest of this step computes it from this component definition.

**Step 1: start from the definition.** Insert the element residual, Eq. $\eqref{elem_residual}$, into Eq. $\eqref{tangent_def}$. The shape functions and the element domain do not depend on $\mathsf d^\mathbf{e}$, and neither does the traction term (a dead load), so the derivative passes through the integral and acts only on $\bm P^h$:

$$
K^{\mathbf{a}\mathbf{b}}_{kl}
= \frac{\partial}{\partial d^\mathbf{b}_l} \left[\,
\int_{\Omega^\mathbf{e}} \sum_{J} N^\mathbf{a}_{,J}\, P^h_{kJ} \; dV
- \int_{\partial\Omega^\mathbf{e} \cap \Gamma_N} N^\mathbf{a}\, \bar T_k \; dA
\,\right]
= \int_{\Omega^\mathbf{e}} \sum_{J} N^\mathbf{a}_{,J}\, \frac{\partial P^h_{kJ}}{\partial d^\mathbf{b}_l} \; dV .
$$

**Step 2: differentiate $\bm P^h = \bm F^h\bm S^h$.** By the product rule,

$$
\frac{\partial P^h_{kJ}}{\partial d^\mathbf{b}_l}
= \sum_{I} \frac{\partial F^h_{kI}}{\partial d^\mathbf{b}_l}\, S^h_{IJ} + \sum_{I} F^h_{kI}\, \frac{\partial S^h_{IJ}}{\partial d^\mathbf{b}_l} .
$$

**Step 3: the two derivatives.** The first was found at the start of this step. The second goes through the strain, with the material elasticity tensor $\mathbb C^h = \partial\bm S^h/\partial\bm E^h$, which is symmetric in $IJ$ and in $KL$:

$$
\frac{\partial F^h_{kI}}{\partial d^\mathbf{b}_l} = \delta_{kl}\, N^\mathbf{b}_{,I},
\qquad
\frac{\partial S^h_{IJ}}{\partial d^\mathbf{b}_l}
= \sum_{K,L} \mathbb C^h_{IJKL}\, \frac{\partial E^h_{KL}}{\partial d^\mathbf{b}_l}
= \sum_{K,L} \mathbb C^h_{IJKL}\, F^h_{lK}\, N^\mathbf{b}_{,L} ,
$$

since $\partial E^h_{KL}/\partial d^\mathbf{b}_l = \tfrac12 ( N^\mathbf{b}_{,K} F^h_{lL} + F^h_{lK} N^\mathbf{b}_{,L} )$ and the minor symmetry of $\mathbb C^h$ merges the two halves. Renaming $I \to L$ in the first term (and using $S^h_{LJ} = S^h_{JL}$), both terms end in $N^\mathbf{b}_{,L}$:

$$
\frac{\partial P^h_{kJ}}{\partial d^\mathbf{b}_l}
= \sum_{L} \Big( \sum_{I,K} F^h_{kI}\, \mathbb C^h_{IJKL}\, F^h_{lK} + \delta_{kl}\, S^h_{JL} \Big)\, N^\mathbf{b}_{,L} .
\label{dP_dd}
$$

**Step 4: back into $K^{\mathbf{a}\mathbf{b}}_{kl}$.** Substituting Eq. $\eqref{dP_dd}$ into Step 1 gives the element stiffness tensor:

$$
\boxed{\;
K^{\mathbf{a}\mathbf{b}}_{kl} = \int_{\Omega^\mathbf{e}} \sum_{J,L} N^\mathbf{a}_{,J}\; \mathbb A^h_{kJlL}\; N^\mathbf{b}_{,L} \; dV,
\qquad
\mathbb A^h_{kJlL} = \underbrace{\sum_{I,K} F^h_{kI}\; \mathbb C^h_{IJKL}\; F^h_{lK}}_{\text{material}} \;+\; \underbrace{\delta_{kl}\; S^h_{JL}}_{\text{geometric}}
\;}
\label{elem_tangent}
$$

The bracket is the first elasticity tensor $\mathbb A^h = \partial\bm P^h/\partial\bm F^h$ of step 4: **the residual needs $\bm P^h$, and the tangent needs $\mathbb A^h$**, with one shape function gradient on each side.

**From $K^{\mathbf{a}\mathbf{b}}_{kl}$ to $\mathsf K^\mathbf{e}$.** The element stiffness matrix of Eq. $\eqref{tangent_def}$ stores these components. Each pair (node, direction) is one element unknown, and the unknowns are numbered direction by direction, as in MFEM: first the $x$-components of nodes $1, \dots, n$, then the $y$-components, then the $z$-components. The pair $(\mathbf{a}, k)$ is therefore unknown number $\mathbf{a} + (k-1)\,n$, and
$$
\big(\mathsf K^\mathbf{e}\big)_{PQ} = K^{\mathbf{a}\mathbf{b}}_{kl},
\qquad
P = \mathbf{a} + (k-1)\,n,
\quad
Q = \mathbf{b} + (l-1)\,n,
\qquad
\mathsf K^\mathbf{e} \in \mathbb R^{3n \times 3n} .
$$

The row $P$ comes from the residual, node $\mathbf{a}$ in direction $k$; the column $Q$ from the displacement, node $\mathbf{b}$ in direction $l$. Grouping the rows and columns by direction, $\mathsf K^\mathbf{e}$ is a $3 \times 3$ array of $n \times n$ blocks, one block for each pair of directions $(k, l)$, and inside a block the nodes $(\mathbf{a}, \mathbf{b})$ pick the entry:

$$
\mathsf K^\mathbf{e} =
\begin{bmatrix}
\mathsf K_{11} & \mathsf K_{12} & \mathsf K_{13} \\
\mathsf K_{21} & \mathsf K_{22} & \mathsf K_{23} \\
\mathsf K_{31} & \mathsf K_{32} & \mathsf K_{33}
\end{bmatrix},
\qquad
\big(\mathsf K_{kl}\big)_{\mathbf{a}\mathbf{b}} = K^{\mathbf{a}\mathbf{b}}_{kl} .
$$

**The code.** `AssembleElementGrad` evaluates Eq. $\eqref{elem_tangent}$ at the same quadrature points as the residual:

```c++
void AssembleElementGrad(const mfem::FiniteElement &elem,
                         mfem::ElementTransformation &elem_map,
                         const mfem::Vector &disp,
                         mfem::DenseMatrix &tangent) override
{
   ...
   for (int qq = 0; qq < quad_rule.GetNPoints(); qq++)
   {
      ...
      const Tensor2_3D F = get_deformation_gradient(disp, dN_dX);

      const Tensor4_3D AA = material.get_1st_elasticity_tensor(F);

      // dV = w_q * det( dX/dxi )
      const double dV = quad_pt.weight * elem_map.Weight();

      for (int aa = 0; aa < num_nodes; aa++)
      {
         const Vector_3D dNa_dX(dN_dX(aa, 0), dN_dX(aa, 1), dN_dX(aa, 2));

         for (int bb = 0; bb < num_nodes; bb++)
         {
            const Vector_3D dNb_dX(dN_dX(bb, 0), dN_dX(bb, 1), dN_dX(bb, 2));

            // N_a,J AA_kJlL N_b,L
            for (int kk = 0; kk < 3; kk++)
               for (int ll = 0; ll < 3; ll++)
                  tangent(aa+kk*num_nodes, bb+ll*num_nodes) += dV *
                     ( dNa_dX(0) * (AA(kk, 0, ll, 0) * dNb_dX(0)
                                 +  AA(kk, 0, ll, 1) * dNb_dX(1)
                                 +  AA(kk, 0, ll, 2) * dNb_dX(2))
                     + dNa_dX(1) * (...)
                     + dNa_dX(2) * (...));
         }
      }
   }
}
```

| Symbol | Code |
|---|---|
| $\mathbb A^h_{kJlL}$ | `AA(kk, J, ll, L)` |
| $N^\mathbf{a}_{,J}$, $N^\mathbf{b}_{,L}$ | `dNa_dX(J)`, `dNb_dX(L)` |
| $(\mathsf K^\mathbf{e})_{PQ}$ | `tangent(aa+kk*num_nodes, bb+ll*num_nodes)`, all indices counted from 0 |

- **The loop is Eq. $\eqref{elem_tangent}$ written out**: two loops over the nodes, two over the directions, and the sums over $J$ and $L$ spelled out.
- **`AssembleElementGrad` is the second fixed name**, called by `NonlinearForm::GetGradient`. Both functions compute $\bm F^h$ with the same `get_deformation_gradient`.

## 8. Quadrature

```c++
static const mfem::IntegrationRule &get_quad_rule(
   const mfem::FiniteElement &elem, mfem::ElementTransformation &elem_map)
{
   return mfem::IntRules.Get(elem.GetGeomType(), 2 * elem_map.OrderGrad(&elem));
}
```

The element integrals are evaluated with **Gauss–Legendre quadrature** on the reference element $\hat\Omega$. With the mapping $\bm\xi \mapsto \bm X^\mathbf{e}(\bm\xi)$,

$$
K^{\mathbf{a}\mathbf{b}}_{kl}
\approx \sum_{q} \omega_q \det\!\left(\frac{\partial\bm X}{\partial\bm\xi}\right) \sum_{J,L} N^{\mathbf{a}}_{,J}\, \mathbb A^h_{kJlL}\, N^{\mathbf{b}}_{,L}\,\bigg|_{\bm\xi_q},
$$

and $R^\mathbf{a}_k$ in the same way. At each point $\bm\xi_q$ the integrand is evaluated from the current $\mathsf d^\mathbf{e}$: $\bm F^h$, then $\bm S^h$ and $\mathbb C^h$ from the material law, then $\mathbb A^h$. `quad_pt.weight` is $\omega_q$ and `elem_map.Weight()` is $\det(\partial\bm X/\partial\bm\xi)$; their product is `dV`.

**How many points.** The code uses linear hexahedra (`H1_FECollection` of order 1), and `get_quad_rule` asks MFEM for a Gauss rule exact up to degree $2 \times$ (degree of $\operatorname{Grad} N^\mathbf{a}$):

- **The factor 2.** The integrand of $K^{\mathbf{a}\mathbf{b}}_{kl}$ contains two shape function gradients, $N^\mathbf{a}_{,J}$ and $N^\mathbf{b}_{,L}$. In linear elasticity $\mathbb A^h$ is constant and the integrand is then a polynomial of degree 4, so the rule is exact in the small-strain limit.
- **Three points per direction.** A 1D Gauss rule with $m$ points is exact up to degree $2m - 1$, so degree 4 needs $m = 3$, and the hexahedron uses the tensor product, $3^3 = 27$ points.
- **Not exact, but consistent.** The Neo-Hookean $\mathbb A^h$ is not a polynomial in $\bm\xi$, so the rule is accurate rather than exact. What matters more is that the residual and the tangent use the same rule (both call `get_quad_rule`): only then is $\mathsf K^\mathbf{e}$ the exact derivative of the discrete $\mathsf R^\mathbf{e}$, and Newton's method converges quadratically.

## 9. Newton's method

```c++
mfem::GSSmoother preconditioner;
mfem::CGSolver linear_solver;
linear_solver.SetRelTol(1.0e-6);
linear_solver.SetAbsTol(0.0);
linear_solver.SetMaxIter(500);
linear_solver.SetPrintLevel(0);
linear_solver.SetPreconditioner(preconditioner);

mfem::NewtonSolver newton_solver;
newton_solver.SetOperator(nonlinear_form);
newton_solver.SetSolver(linear_solver);
newton_solver.SetRelTol(1.0e-8);
newton_solver.SetAbsTol(0.0);
newton_solver.SetMaxIter(20);
newton_solver.SetPrintLevel(1);
newton_solver.iterative_mode = true;

const mfem::Vector zero_rhs;
newton_solver.Mult(zero_rhs, disp_true);
MFEM_VERIFY(newton_solver.GetConverged(), "Newton did not converge.");

disp.SetFromTrueDofs(disp_true);
```

Everything above happens inside one element, and it is all the integrator has to provide: `AssembleElementVector` returns $\mathsf R^\mathbf{e}$ and `AssembleElementGrad` returns $\mathsf K^\mathbf{e}$. The rest is done by MFEM.

- **Assembly.** `NonlinearForm` loops over the elements, calls the integrator, and adds $\mathsf R^\mathbf{e}$ and $\mathsf K^\mathbf{e}$ into the global $\mathsf R$ and $\mathsf K$ at the global numbers returned by `GetElementVDofs`, the local unknown $(\mathbf{a}, k)$ going to the global unknown $(\ell(\mathbf{e},\mathbf{a}), k)$. A node shared by several elements receives the sum of their contributions, $R^\mathbf{A}_k = \sum_{\mathbf{e} \ni \mathbf{A}} R^\mathbf{a}_k(\mathbf{e})$, and $\mathsf K$ is assembled the same way.
- **Newton's method.** The discrete problem is $R^\mathbf{A}_k(\mathsf d) = 0$ for every free unknown. `NewtonSolver` repeats: assemble $\mathsf R$ and $\mathsf K$ at the current $\mathsf d$, solve $\mathsf K\, \Delta\mathsf d = -\mathsf R$, update $\mathsf d \leftarrow \mathsf d + \Delta\mathsf d$, until $\mathsf R \approx \mathsf 0$. Since $\mathsf K^\mathbf{e}$ is the exact derivative of $\mathsf R^\mathbf{e}$, the convergence is quadratic.

$$
\|\mathsf R(\mathsf d)\| \;\le\; 10^{-8}\, \|\mathsf R(\mathsf d_0)\|
$$

- **`zero_rhs` is empty**, which tells `NewtonSolver` to solve $\mathsf R(\mathsf d) = \mathsf 0$.
- **`iterative_mode = true` is essential.** It makes Newton start from `disp_true`, which carries the prescribed $\bar u$ of step 3; with the default `false`, Newton would first set the initial guess to zero and wipe out the boundary values.
- **CG applies because $\mathsf K$ is symmetric**: $\mathbb A^h_{kJlL} = \mathbb A^h_{lLkJ}$, and replacing constrained rows and columns by the identity keeps the symmetry. Each linear solve only needs to be accurate to $10^{-6}$, since Newton corrects it in the next iteration.
- **`SetPrintLevel(1)` prints the residual norm of every iteration**, and quadratic convergence, the norm roughly squaring from one iteration to the next, is the most direct check of the integrator.
- `SetFromTrueDofs` copies the solution back into `disp`, the finite element function.

> First edited on Sep. 26, 2026.
>
> Writing this post was truly exhausting. I read a lot of code and textbooks, and revised the content again and again until it reflected what I was actually thinking. Of course, I used AI agents to help me organize the whole article.
>
> I do find MFEM useful. It focuses on solving differential equations, so you have to derive the weak form yourself. Once that first step is done, however, the structure extends naturally to more specific problems, such as hyperelastodynamics, and it stays really clear.
